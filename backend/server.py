from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-in-production-2024-cineviax")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 43200  # 30 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# TMDB API Configuration
TMDB_API_KEY = "603ebfea4d9de49889a598831d13273f"
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserSignup(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class Movie(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    tmdb_id: int
    title: str
    poster_path: Optional[str] = None
    poster_base64: Optional[str] = None
    tmdb_rating: Optional[float] = None
    genres: List[str] = []
    year: Optional[str] = None
    media_type: str  # "movie" or "tv"
    watched: bool = False
    personal_rating: Optional[int] = None
    watch_date: Optional[datetime] = None
    added_at: datetime = Field(default_factory=datetime.utcnow)

class MovieCreate(BaseModel):
    tmdb_id: int
    title: str
    poster_path: Optional[str] = None
    tmdb_rating: Optional[float] = None
    genres: List[str] = []
    year: Optional[str] = None
    media_type: str

class MovieUpdate(BaseModel):
    watched: Optional[bool] = None
    personal_rating: Optional[int] = None

# Utility Functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

def download_and_encode_image(image_url: str) -> Optional[str]:
    """Download image from URL and convert to base64"""
    try:
        import base64
        response = requests.get(image_url, timeout=10)
        if response.status_code == 200:
            encoded = base64.b64encode(response.content).decode('utf-8')
            # Detect image type from content
            content_type = response.headers.get('content-type', 'image/jpeg')
            return f"data:{content_type};base64,{encoded}"
        return None
    except Exception as e:
        logger.error(f"Error downloading image: {e}")
        return None

# Authentication Routes
@api_router.post("/signup", response_model=Token)
async def signup(user_data: UserSignup):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password)
    )
    await db.users.insert_one(user.dict())
    
    # Create access token
    access_token = create_access_token(data={"sub": user.id})
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.post("/login", response_model=Token)
async def login(user_data: UserLogin):
    # Find user
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create access token
    access_token = create_access_token(data={"sub": user["id"]})
    return {"access_token": access_token, "token_type": "bearer"}

# Movie Routes
@api_router.get("/movies")
async def get_movies(user_id: str = Depends(get_current_user)):
    movies = await db.movies.find({"user_id": user_id}).to_list(1000)
    return movies

@api_router.post("/movies")
async def add_movie(movie_data: MovieCreate, user_id: str = Depends(get_current_user)):
    # Check if movie already exists for this user
    existing = await db.movies.find_one({
        "user_id": user_id,
        "tmdb_id": movie_data.tmdb_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Movie already in your list")
    
    # Download and encode poster image if available
    poster_base64 = None
    if movie_data.poster_path:
        full_url = f"{TMDB_IMAGE_BASE}{movie_data.poster_path}"
        poster_base64 = download_and_encode_image(full_url)
    
    # Create movie
    movie = Movie(
        user_id=user_id,
        tmdb_id=movie_data.tmdb_id,
        title=movie_data.title,
        poster_path=movie_data.poster_path,
        poster_base64=poster_base64,
        tmdb_rating=movie_data.tmdb_rating,
        genres=movie_data.genres,
        year=movie_data.year,
        media_type=movie_data.media_type
    )
    await db.movies.insert_one(movie.dict())
    return movie

@api_router.put("/movies/{movie_id}")
async def update_movie(movie_id: str, movie_data: MovieUpdate, user_id: str = Depends(get_current_user)):
    # Find movie
    movie = await db.movies.find_one({"id": movie_id, "user_id": user_id})
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    
    # Update fields
    update_data = {}
    if movie_data.watched is not None:
        update_data["watched"] = movie_data.watched
        if movie_data.watched:
            update_data["watch_date"] = datetime.utcnow()
    if movie_data.personal_rating is not None:
        update_data["personal_rating"] = movie_data.personal_rating
    
    await db.movies.update_one(
        {"id": movie_id},
        {"$set": update_data}
    )
    
    # Return updated movie
    updated_movie = await db.movies.find_one({"id": movie_id})
    return updated_movie

@api_router.delete("/movies/{movie_id}")
async def delete_movie(movie_id: str, user_id: str = Depends(get_current_user)):
    result = await db.movies.delete_one({"id": movie_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Movie not found")
    return {"message": "Movie deleted successfully"}

# TMDB Search Route
@api_router.get("/search/tmdb")
async def search_tmdb(query: str, user_id: str = Depends(get_current_user)):
    try:
        # Search for multi (movies and TV shows)
        response = requests.get(
            f"{TMDB_BASE_URL}/search/multi",
            params={
                "api_key": TMDB_API_KEY,
                "query": query,
                "page": 1
            },
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        # Filter only movies and TV shows
        results = []
        for item in data.get("results", []):
            if item.get("media_type") in ["movie", "tv"]:
                # Get genre names
                genres = []
                if "genre_ids" in item:
                    # Map genre IDs to names (simplified)
                    genre_map = {
                        28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
                        80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
                        14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
                        9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV",
                        53: "Thriller", 10752: "War", 37: "Western"
                    }
                    genres = [genre_map.get(gid, "") for gid in item.get("genre_ids", [])]
                    genres = [g for g in genres if g]
                
                results.append({
                    "tmdb_id": item.get("id"),
                    "title": item.get("title") or item.get("name"),
                    "poster_path": item.get("poster_path"),
                    "tmdb_rating": item.get("vote_average"),
                    "genres": genres,
                    "year": (item.get("release_date") or item.get("first_air_date", ""))[:4],
                    "media_type": item.get("media_type"),
                    "overview": item.get("overview", "")
                })
        
        return {"results": results}
    except Exception as e:
        logger.error(f"TMDB search error: {e}")
        raise HTTPException(status_code=500, detail="Failed to search TMDB")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
