if (document.location.pathname === "/challenges") {
    var currentlyLoadedChallenge = null;

    $.get('/pn-uuid', function(data) {
        var config = JSON.parse(data);
        var uuid = config.uuid;
        var subKey = config.subKey;
        var pub = new PubNub({
            subscribeKey: subKey,
            presenceTimeout: 60,
            uuid: uuid
        });

        var currentlyJoined = null;
        var channels = {};

        var channelInfoChanged = function() {
            var channelInfo = channels[currentlyJoined];
            var users = channelInfo.users.filter(function(e) { return e !== uuid; });
            var count = channelInfo.count - 1;

            // PubNub won't return individual names once the channel gets over a (configurable) size.
            var string = (count > 0 ? count : "No")+" other team-member"+(count != 1 ? "s are" : " is")+" viewing.";
            if (users.length > 0) {
                string = "Other team-members viewing: "+users.join(', ');
            }


            if ($("#challenge-now-viewing").length == 0) {
                // Insert "now viewing" location.
                $('<div id="challenge-now-viewing" class="text-center p3"></div>').insertBefore($('#challenge .challenge-name'));
            }

            $('#challenge-now-viewing').text(string);
        }

        pub.addListener({
            presence: function(e) { // Someone just joined/left!
                // Get current users
                var users = channels[e.channel].users;

                // Add or remove the user
                if (e.action == "leave") {
                    users = users.filter(function(elem) { return elem != e.uuid; });
                } else if (e.action == "join") {
                    users.push(e.uuid);
                }

                // De-dupe
                var uniqueUsers = [];
                $.each(users, function(i, el){
                    if($.inArray(el, uniqueUsers) === -1) uniqueUsers.push(el);
                });

                // Update the users
                channels[e.channel].users = uniqueUsers;
                channels[e.channel].count = e.occupancy;
                channelInfoChanged();
            }
        });

        window.pub = pub;

        var joinChannel = function(channel) {
            console.log('subscribing to ',channel);
            channels[channel] = {users: [], count: 0};
            pub.subscribe({
                channels: [channel],
                withPresence: true
            });

            pub.hereNow(
                {
                    channels: [channel],
                    includeState: true
                },
                function(status, e) {
                    if (e && ('channels' in e)) {
                        channels[channel].count = e.channels[channel].occupancy;
                        channels[channel].users = e.channels[channel].occupants.map(function(occ) { return occ.uuid; });
                    }
                    console.log('initial state', e);
                    channelInfoChanged();
                }
            );
        }

        var leaveChannel = function(channel) {
            pub.unsubscribe({
                channels: [channel]
            });
            channels[channel] = {users: [], count: 0};
        }


        var lastAjax = null;
        window.challengeVisible = function(challenge) {
            if (currentlyJoined !== null) {
                leaveChannel(currentlyJoined);
                currentlyJoined = null;
            }

            if (lastAjax) lastAjax.abort();
            lastAjax = $.get('/realtime', {challenge_id: challenge}, function(channel) {
                lastAjax = null;
                joinChannel(channel);
                currentlyJoined = channel;
            });
        }

        window.challengeInvisible = function() {
            if (currentlyJoined !== null) {
                leaveChannel(currentlyJoined);
                currentlyJoined = null;
            }
        }

        // If we loaded a challenge while we were waiting for the user info, subscribe now.
        if (currentlyLoadedChallenge !== null) {
            window.challengeVisible(currentlyLoadedChallenge);
            currentlyLoadedChallenge = null;
        }
    });


    // While we wait for the user info AJAX request to complete, a few shims.
    window.challengeVisible = function(challenge) {
        currentlyLoadedChallenge = challenge;
    }

    window.challengeInvisible = function() {
        currentlyLoadedChallenge = null;
    }


    // Bind events for standard themes. (If your theme isn't natively supported you will need to call challengeVisible and
    // challengeInvisible yourself.)
    var standardGetFromHash = function(hash) {
        var obj = $.grep(challenges, function (e) {
            return e.name == hash;
        })[0];
        return obj;
    }

    var getFromHash = function() {
        if (document.location.hash && document.location.hash.substring(1)) {
            var hashChal = standardGetFromHash(document.location.hash.substring(1));
            if (hashChal) {
                challengeVisible(hashChal.id);
            } else {
                challengeInvisible();
            }
        } else {
            challengeInvisible();
        }
    }

    var hasLoadedCheck = setInterval(function() {
        if (challenges) {
            clearInterval(hasLoadedCheck);
            getFromHash();
            $(window).bind( 'hashchange', getFromHash);
        }
    }, 500);
}
