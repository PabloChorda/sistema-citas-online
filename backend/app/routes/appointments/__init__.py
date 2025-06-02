from flask import Blueprint

appointments_bp = Blueprint('appointments_bp', __name__)

from . import crud
