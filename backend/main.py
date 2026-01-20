from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import models, schemas, database, auth
import uuid

# Tworzenie tabel
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rejestracja
@app.post("/register", status_code=201)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Ten email jest już zajęty")
    
    hashed_pw = auth.get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    return {"msg": "Użytkownik utworzony"}

# Token
@app.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = auth.authenticate_user(db, username=form_data.username, password=form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Błędny email lub hasło")
    
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

# User info
@app.get("/users/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

# Tworzenie ankiety
@app.post("/polls/", response_model=schemas.Poll)
def create_poll(poll: schemas.PollCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    
    # Porównanie z czasem lokalnym serwera (bez strefy)
    if poll.expires_at < datetime.now():
        raise HTTPException(status_code=400, detail="Data ważności nie może być z przeszłości!")

    unique_code = str(uuid.uuid4())[:6]
    
    db_poll = models.Poll(
        title=poll.title,
        owner_id=current_user.id,
        expires_at=poll.expires_at,
        results_visible_live=poll.results_visible_live,
        invite_code=unique_code
    )
    db.add(db_poll)
    db.commit()
    db.refresh(db_poll)

    db_poll.allowed_users.append(current_user)
    
    for option_text in poll.options:
        db_option = models.Option(text=option_text, poll_id=db_poll.id)
        db.add(db_option)
        db.commit()
        
    db.commit()
    
    setattr(db_poll, 'user_voted', False)
    for opt in db_poll.options:
        setattr(opt, 'vote_count', 0)

    return db_poll

# Dołączanie do ankiety
@app.post("/join/", status_code=200)
def join_poll(join_data: schemas.PollJoin, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    poll = db.query(models.Poll).filter(models.Poll.invite_code == join_data.invite_code).first()
    
    if not poll:
        raise HTTPException(status_code=404, detail="Nieprawidłowy kod ankiety")
    
    if not poll.is_active or (poll.expires_at and poll.expires_at < datetime.now()):
        raise HTTPException(status_code=400, detail="Ta ankieta jest już zakończona.")

    if current_user in poll.allowed_users:
        raise HTTPException(status_code=409, detail="Już należysz do tej ankiety")

    poll.allowed_users.append(current_user)
    db.commit()
    return {"msg": "Dołączono do ankiety", "poll_id": poll.id}

# Pobranie listy ankiet
@app.get("/polls/", response_model=List[schemas.Poll])
def read_polls(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    polls = current_user.joined_polls
    
    now = datetime.now()
    # Zamknięcie ankiet, których data minęła
    for poll in polls:
        if poll.is_active and poll.expires_at and poll.expires_at < now:
            poll.is_active = False
            db.add(poll)
    db.commit()

    # Wyświetlanie
    for poll in polls:
        poll.user_voted = any(vote.user_id == current_user.id for vote in poll.votes)
        
        should_hide_results = (not poll.results_visible_live) and poll.is_active

        if should_hide_results:
             for option in poll.options:
                 setattr(option, 'vote_count', -1)
        else:
             for option in poll.options:
                 count = db.query(models.Vote).filter(models.Vote.option_id == option.id).count()
                 setattr(option, 'vote_count', count)

    return polls

# Głosowanie
@app.post("/vote/", status_code=201)
def vote(vote: schemas.VoteCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    poll = db.query(models.Poll).filter(models.Poll.id == vote.poll_id).first()
    if not poll:
        raise HTTPException(status_code=404, detail="Ankieta nie istnieje")

    if not poll.is_active or (poll.expires_at and poll.expires_at < datetime.now()):
        raise HTTPException(status_code=400, detail="Głosowanie zakończone")

    if current_user not in poll.allowed_users:
        raise HTTPException(status_code=403, detail="Nie masz dostępu do tej ankiety")

    existing_vote = db.query(models.Vote).filter(
        models.Vote.user_id == current_user.id,
        models.Vote.poll_id == vote.poll_id
    ).first()

    if existing_vote:
        raise HTTPException(status_code=400, detail="Już oddałeś głos w tej ankiecie")

    new_vote = models.Vote(
        user_id=current_user.id,
        poll_id=vote.poll_id,
        option_id=vote.option_id
    )
    db.add(new_vote)
    db.commit()
    return {"msg": "Głos został oddany"}

# Usuwanie i opuszczanie ankiety
@app.delete("/polls/{poll_id}", status_code=204)
def delete_poll(poll_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    poll = db.query(models.Poll).filter(models.Poll.id == poll_id).first()
    if not poll:
        raise HTTPException(status_code=404, detail="Ankieta nie istnieje")
    if poll.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Nie możesz usunąć cudzej ankiety")
    db.delete(poll)
    db.commit()
    return

# Opuszczanie ankiety
@app.delete("/polls/{poll_id}/leave", status_code=204)
def leave_poll(poll_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    poll = db.query(models.Poll).filter(models.Poll.id == poll_id).first()
    if not poll:
        raise HTTPException(status_code=404, detail="Ankieta nie istnieje")
    if poll.owner_id == current_user.id:
         raise HTTPException(status_code=400, detail="Właściciel nie może opuścić ankiety.")
    if current_user in poll.allowed_users:
        poll.allowed_users.remove(current_user)
        db.commit()
    return

@app.patch("/polls/{poll_id}/end", status_code=200)
def end_poll(poll_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    poll = db.query(models.Poll).filter(models.Poll.id == poll_id).first()
    
    if not poll:
        raise HTTPException(status_code=404, detail="Ankieta nie istnieje")
    
    if poll.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Tylko właściciel może zakończyć ankietę")

    if not poll.is_active:
        raise HTTPException(status_code=400, detail="Ta ankieta jest już zakończona")

    poll.is_active = False
    db.commit()
    
    return {"msg": "Ankieta została zakończona"}