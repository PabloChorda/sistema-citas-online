from flask import Blueprint

timeblocks_bp = Blueprint('timeblocks_bp', __name__)

from . import crud
