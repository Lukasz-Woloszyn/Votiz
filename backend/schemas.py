from pydantic import BaseModel, EmailStr, field_validator, Field
from typing import List, Optional
import datetime
import re

# Rejestracja i jej walidacja
class UserCreate(BaseModel):
    email: EmailStr
    password: str

    @field_validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Hasło musi mieć min. 8 znaków')
        if not any(char.isdigit() for char in v):
            raise ValueError('Hasło musi zawierać cyfrę')
        if not any(char.isupper() for char in v):
            raise ValueError('Hasło musi zawierać dużą literę')
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
             raise ValueError('Hasło musi zawierać znak specjalny (!@#$...)')
        return v

# Dane użytkownika
class User(BaseModel):
    id: int
    email: str
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class OptionBase(BaseModel):
    text: str = Field(..., max_length=100)

class Option(OptionBase):
    id: int
    poll_id: int
    vote_count: int = 0
    class Config:
        from_attributes = True

class PollBase(BaseModel):
    title: str = Field(..., max_length=150)
    options: List[str]

class PollCreate(PollBase):
    expires_at: datetime.datetime
    results_visible_live: bool = True

class PollJoin(BaseModel):
    invite_code: str = Field(..., max_length=10)

class Poll(BaseModel):
    id: int
    title: str
    owner_id: int
    expires_at: datetime.datetime
    results_visible_live: bool
    options: List[Option]
    user_voted: bool = False
    is_active: bool = True
    invite_code: str

    class Config:
        from_attributes = True

class VoteCreate(BaseModel):
    poll_id: int
    option_id: int