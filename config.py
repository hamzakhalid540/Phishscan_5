import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'phishscan-secret-key'
    TEMPLATES_AUTO_RELOAD = True