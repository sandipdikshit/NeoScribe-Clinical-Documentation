from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session, joinedload
import os
import dotenv

from app.database import get_db

dotenv.load_dotenv()

JWT_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", 30))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v2/providers/token")

async def get_current_provider(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_KEY, algorithms=[JWT_ALGORITHM])
        provider_id: str = payload.get("id")
        if provider_id is None:
            print("No provider ID found in token")
            raise credentials_exception
    except JWTError:
        print("JWT error: ", JWTError)
        raise credentials_exception
    
    # Import here to avoid circular import
    from app.v2.models.provider import ProviderModel
    
    provider = db.query(ProviderModel)\
        .options(joinedload(ProviderModel.role))\
        .filter(ProviderModel.iUserId == provider_id, ProviderModel.tiStatus == 1)\
        .first()
    
    return provider 