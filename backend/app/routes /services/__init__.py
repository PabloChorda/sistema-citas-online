from flask import Blueprint

services_bp = Blueprint('services_bp', __name__)

from . import crud
