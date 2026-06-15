from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
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
from pymongo.errors import DuplicateKeyError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    raise RuntimeError('MONGO_URL is required. Copy backend/.env.example to backend/.env and set MONGO_URL.')

db_name = os.environ.get('DB_NAME', 'cineviax')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError('SECRET_KEY is required. Copy backend/.env.example to backend/.env and set SECRET_KEY.')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 43200  # 30 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Add basic security headers
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "no-referrer-when-downgrade"
    return response

# TMDB API Configuration
TMDB_API_KEY = os.environ.get("TMDB_API_KEY")
if not TMDB_API_KEY:
    raise RuntimeError('TMDB_API_KEY is required. Set it in backend/.env or your environment.')
TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserSignup(BaseModel):
    name: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserProfile(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    is_guest: bool = False

class UserProfileUpdate(BaseModel):
    name: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserProfile

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

def user_to_profile(user: dict) -> dict:
    email = user.get("email")
    fallback_name = email.split("@")[0] if email else "Cineviax User"
    return {
        "id": user["id"],
        "name": user.get("name") or fallback_name,
        "email": email,
        "phone": user.get("phone"),
        "is_guest": False,
    }

def guest_profile(user_id: str) -> dict:
    return {
        "id": user_id,
        "name": "Guest User",
        "email": None,
        "phone": None,
        "is_guest": True,
    }

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

TMDB_GENRE_CACHE: dict = {
    "movie": {"genres": {}, "updated_at": None},
    "tv": {"genres": {}, "updated_at": None},
}


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


def tmdb_search(path: str, params: dict):
    headers = {}
    if TMDB_API_KEY.startswith("eyJ"):
        # TMDB v4 Read Access Token (JWT)
        headers["Authorization"] = f"Bearer {TMDB_API_KEY}"
        params = {**params, "language": "en-US"}
    else:
        # TMDB v3 API Key
        params = {**params, "api_key": TMDB_API_KEY, "language": "en-US"}
    try:
        response = requests.get(f"{TMDB_BASE_URL}/{path}", params=params, headers=headers, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        logger.error(f"TMDB request failed for {path}: {exc}")
        raise


def load_tmdb_genres(media_type: str) -> dict:
    media_cache = TMDB_GENRE_CACHE.get(media_type, {})
    updated_at = media_cache.get("updated_at")
    if updated_at and (datetime.utcnow() - updated_at).seconds < 86400:
        return media_cache.get("genres", {})

    try:
        response = tmdb_search(f"genre/{media_type}/list", {})
        genres = {item["id"]: item["name"] for item in response.get("genres", [])}
        TMDB_GENRE_CACHE[media_type] = {
            "genres": genres,
            "updated_at": datetime.utcnow(),
        }
        return genres
    except Exception as exc:
        logger.warning(f"Unable to load TMDB genres for {media_type}: {exc}")
        return {}


def map_tmdb_item(item: dict) -> dict:
    if item.get("media_type") == "tv":
        title = item.get("name")
        year = (item.get("first_air_date") or "")[:4]
        genre_map = load_tmdb_genres("tv")
    else:
        title = item.get("title") or item.get("name")
        year = (item.get("release_date") or "")[:4]
        genre_map = load_tmdb_genres("movie")

    genres = [genre_map.get(gid, "") for gid in item.get("genre_ids", [])]
    genres = [g for g in genres if g]
    return {
        "tmdb_id": item.get("id"),
        "title": title,
        "poster_path": item.get("poster_path"),
        "tmdb_rating": item.get("vote_average"),
        "genres": genres,
        "year": year,
        "media_type": item.get("media_type") or ("tv" if item.get("first_air_date") else "movie"),
        "overview": item.get("overview", ""),
    }

# Authentication Routes
@api_router.post("/signup", response_model=Token)
async def signup(user_data: UserSignup):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    display_name = user_data.name.strip() if user_data.name else user_data.email.split("@")[0]
    user = User(
        name=display_name,
        email=user_data.email,
        phone=user_data.phone.strip() if user_data.phone else None,
        password_hash=get_password_hash(user_data.password)
    )
    await db.users.insert_one(user.dict())
    
    # Create access token
    access_token = create_access_token(data={"sub": user.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_to_profile(user.dict()),
    }

@api_router.post("/login", response_model=Token)
async def login(user_data: UserLogin):
    # Find user
    user = await db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create access token
    access_token = create_access_token(data={"sub": user["id"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_to_profile(user),
    }

@api_router.post("/guest", response_model=Token)
async def guest_login():
    guest_id = f"guest-{uuid.uuid4()}"
    profile = guest_profile(guest_id)
    access_token = create_access_token(data={"sub": guest_id, "is_guest": True})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": profile,
    }

@api_router.get("/me", response_model=UserProfile)
async def get_profile(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        if payload.get("is_guest"):
            return guest_profile(user_id)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user_to_profile(user)

@api_router.patch("/me", response_model=UserProfile)
async def update_profile(
    profile_data: UserProfileUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        if payload.get("is_guest"):
            raise HTTPException(status_code=403, detail="Create an account to edit your profile")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    name = profile_data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    if len(name) > 80:
        raise HTTPException(status_code=400, detail="Name must be 80 characters or fewer")

    result = await db.users.update_one({"id": user_id}, {"$set": {"name": name}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    user = await db.users.find_one({"id": user_id})
    return user_to_profile(user)

# Movie Routes
@api_router.get("/movies")
async def get_movies(user_id: str = Depends(get_current_user)):
    movies = await db.movies.find({"user_id": user_id}).to_list(1000)
    # Convert MongoDB documents to proper format
    for movie in movies:
        if "_id" in movie:
            del movie["_id"]  # Remove MongoDB ObjectId
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
    try:
        await db.movies.insert_one(movie.dict())
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Movie already in your list")
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
    if updated_movie and "_id" in updated_movie:
        del updated_movie["_id"]  # Remove MongoDB ObjectId
    return updated_movie

@api_router.delete("/movies/{movie_id}")
async def delete_movie(movie_id: str, user_id: str = Depends(get_current_user)):
    result = await db.movies.delete_one({"id": movie_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Movie not found")
    return {"message": "Movie deleted successfully"}

# TMDB Search Route
@api_router.get("/search/tmdb")
async def search_tmdb(query: str, page: int = 1, user_id: str = Depends(get_current_user)):
    try:
        response = tmdb_search("search/multi", {"query": query, "page": page})
        results = [map_tmdb_item(item) for item in response.get("results", []) if item.get("media_type") in ["movie", "tv"]]
        return {
            "results": results,
            "total_pages": response.get("total_pages", 1),
            "page": response.get("page", 1)
        }
    except Exception as e:
        logger.error(f"TMDB search error: {e}")
        raise HTTPException(status_code=500, detail="Failed to search TMDB")


def safe_tmdb_results(path: str, params: dict) -> list:
    try:
        response = tmdb_search(path, params)
        return [map_tmdb_item(item) for item in response.get("results", [])][:12]
    except Exception as e:
        logger.warning(f"TMDB fallback for {path}: {e}")
        return []


@api_router.get("/tmdb/trending")
async def tmdb_trending(user_id: str = Depends(get_current_user)):
    return {"results": safe_tmdb_results("trending/all/day", {"page": 1})}


@api_router.get("/tmdb/popular")
async def tmdb_popular(user_id: str = Depends(get_current_user)):
    return {"results": safe_tmdb_results("movie/popular", {"page": 1})}


@api_router.get("/tmdb/top-rated")
async def tmdb_top_rated(user_id: str = Depends(get_current_user)):
    return {"results": safe_tmdb_results("movie/top_rated", {"page": 1})}


@api_router.get("/tmdb/recommendations")
async def tmdb_recommendations(user_id: str = Depends(get_current_user)):
    return {"results": safe_tmdb_results("movie/now_playing", {"page": 1})}


# Include the router in the main app
app.include_router(api_router)

cors_origins = os.environ.get("CORS_ALLOWED_ORIGINS")
allowed_origins = [origin.strip() for origin in cors_origins.split(",")] if cors_origins else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def cleanup_duplicate_movies():
    try:
        # Group movies by user_id and tmdb_id, and if count > 1, delete all but the first one
        pipeline = [
            {
                "$group": {
                    "_id": {"user_id": "$user_id", "tmdb_id": "$tmdb_id"},
                    "ids": {"$push": "$id"},
                    "count": {"$sum": 1}
                }
            },
            {"$match": {"count": {"$gt": 1}}}
        ]
        cursor = db.movies.aggregate(pipeline)
        async for group in cursor:
            # Keep the first ID, delete the rest
            ids_to_keep = group["ids"][0]
            ids_to_delete = group["ids"][1:]
            logger.info(f"Removing duplicate movies for user {group['_id']['user_id']}, tmdb_id {group['_id']['tmdb_id']}: {ids_to_delete}")
            await db.movies.delete_many({"id": {"$in": ids_to_delete}})
    except Exception as e:
        logger.error(f"Error during duplicate movies cleanup: {e}")

@app.on_event("startup")
async def startup_db_client():
    # Cleanup duplicates and create unique index
    await cleanup_duplicate_movies()
    try:
        await db.movies.create_index([("user_id", 1), ("tmdb_id", 1)], unique=True)
        logger.info("Created unique index on movies collection")
    except Exception as e:
        logger.error(f"Error creating unique index on movies collection: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@app.get("/")
async def root():
    return {"message": "Cineviax API running"}
