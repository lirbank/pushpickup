Meteor.methods({
  "nearest-past-games": function (location) {
    this.unblock();
    check(location, GeoJSONPoint);
    return Games.find({
      'startsAt': {$lt: new Date()},
      'location.geoJSON': {$near: {$geometry: location}}
    }, {limit: 15}).fetch();
  },
  "inviteFriends": function (emails, gameId) {
    this.unblock();
    check(emails, [ValidEmail]);
    check(gameId, String);
    var game = Games.findOne(gameId);
    var user = Meteor.users.findOne(this.userId);
    if (!game || !user) return;
    _.each(emails, function (email) {
      Email.send({
        from: user.emails[0].address,
        to: email,
        subject: user.profile.name + " invited you to play "+game.type+" at "
          + game.displayTime(),
        text: "Want to join in? Below is a link to the game.\n\n"
          + Meteor.absoluteUrl('g/'+gameId)
          + "\nThanks for helping to push pickup."
      });
    });
  },
  "notifyPlayers": function (gameId) {
    this.unblock();
    check(gameId, String);
    var game = Games.findOne(gameId);
    if (!game)
      return;
    var players = _.compact(_.map(game.players, function (player) {
      var user = player.userId &&
            player.userId !== game.creator.userId &&
            Meteor.users.findOne(player.userId);
      if (user && user.emails && user.emails[0].verified) {
        return {
          name: user.profile && user.profile.name || "Push Pickup User",
          address: user.emails[0].address
        };
      } else {
        return null;
      }
    }));
    _.each(players, function (player) {
      Email.send({
        from: emailTemplates.from,
        to: player.address,
        subject: " Game *updated*: "+game.type+" at "
          + game.displayTime(),
        text: "Details for a game you're playing in have changed. " +
          "Below is a link to the game.\n\n"
          + Meteor.absoluteUrl('g/'+gameId)
          + "\nThanks for helping to push pickup."
      });
    });
  },
  "sendVerificationEmail": function () {
    this.unblock();
    this.userId && Accounts.sendVerificationEmail(this.userId);
  },
  "changeEmailAddress": function (newEmail) {
    this.unblock();
    check(newEmail, ValidEmail);
    if (! this.userId) {
      throw new Meteor.Error(
        401, "You must be signed in to change your email address.");
    }
    var available = Meteor.call("isEmailAvailable", newEmail);
    console.log("got here");
    if (! available) {
      throw new Meteor.Error(
        403, "Someone has already added and verified that email address");
    }
    var user = Meteor.users.findOne(this.userId);
    var oldEmail = user.emails[0].address;
    Meteor.users.update(this.userId, {
      $push: {emails: {address: newEmail, verified: false}}
    });
    Meteor.users.update(this.userId, {
      $pull: {emails: {address: oldEmail}}
    });
    Accounts.sendVerificationEmail(this.userId, newEmail);
    return true;
  },
  "makeAdmin": function (userId) {
    var self = this;
    check(userId, String);
    var requester = Meteor.users.findOne(self.userId);
    if (requester && requester.admin) {
      Meteor.users.update(userId, {$set: {admin: true}});
      return true;
    } else {
      return false;
    }
  }
});
