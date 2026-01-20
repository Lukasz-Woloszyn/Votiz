from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Table
from sqlalchemy.orm import relationship
from database import Base
import datetime

# Tabela łącząca - sprawdzanie dostępu użytkowników do ankiet
poll_access = Table(
    'poll_access', Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('poll_id', Integer, ForeignKey('polls.id'))
)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    joined_polls = relationship("Poll", secondary=poll_access, back_populates="allowed_users")

class Poll(Base):
    __tablename__ = "polls"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    expires_at = Column(DateTime)
    results_visible_live = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    invite_code = Column(String, unique=True, index=True)
    options = relationship("Option", back_populates="poll")
    votes = relationship("Vote", back_populates="poll")
    allowed_users = relationship("User", secondary=poll_access, back_populates="joined_polls")

class Option(Base):
    __tablename__ = "options"
    id = Column(Integer, primary_key=True, index=True)
    text = Column(String)
    poll_id = Column(Integer, ForeignKey("polls.id"))
    poll = relationship("Poll", back_populates="options")
    votes = relationship("Vote", back_populates="option")

class Vote(Base):
    __tablename__ = "votes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    poll_id = Column(Integer, ForeignKey("polls.id"))
    option_id = Column(Integer, ForeignKey("options.id"))
    
    poll = relationship("Poll", back_populates="votes")
    option = relationship("Option", back_populates="votes")