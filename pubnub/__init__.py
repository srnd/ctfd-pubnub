import re
import string
import hmac
import os
import json
from hashlib import sha1
from flask import request, abort
from CTFd.models import db, Challenges
from CTFd.utils.user import get_current_user, get_current_team, authed
from CTFd.plugins import register_plugin_assets_directory
from CTFd.utils.plugins import register_script
from CTFd.utils.decorators import during_ctf_time_only
from CTFd.utils.decorators.visibility import check_challenge_visibility
from CTFd import utils

def load(app):
    register_script('https://cdn.pubnub.com/sdk/javascript/pubnub.4.21.7.min.js')
    register_script('/plugins/pubnub/assets/pubnub.js')
    register_plugin_assets_directory(app, base_path='/plugins/pubnub/assets/')


    @app.route('/realtime', methods=['GET'])
    @during_ctf_time_only
    @check_challenge_visibility
    def get_challenge_token():
        if authed() is False:
            abort(404)

        # Does the challenge exist? If not, 404.
        challenge_id = request.values.get('challenge_id')
        Challenges.query.filter_by(id=challenge_id).first_or_404()

        team = get_current_team()

        return hmac.new(os.environ.get('SECRET'), ','.join((str(challenge_id), str(team.id))), sha1).hexdigest()

    @app.route('/pn-uuid', methods=['GET'])
    def get_user_info():
        if authed() is False:
            abort(404)

        return json.dumps({"uuid": get_current_user().name, "subKey": os.environ.get('PUBNUB_SUB')})
