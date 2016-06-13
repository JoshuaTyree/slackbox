var express       = require('express');
var bodyParser    = require('body-parser');
var request       = require('request');
var dotenv        = require('dotenv');
var SpotifyWebApi = require('spotify-web-api-node');
var applescript   = require('applescript');

dotenv.load();

var spotifyApi = new SpotifyWebApi({
  clientId     : process.env.SPOTIFY_KEY,
  clientSecret : process.env.SPOTIFY_SECRET,
  redirectUri  : process.env.SPOTIFY_REDIRECT_URI
});

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

app.get('/', function(req, res) {
  if (spotifyApi.getAccessToken()) {
    return res.send('You are logged in.');
  }
  return res.send('<a href="/authorise">Authorise</a>');
});

app.get('/authorise', function(req, res) {
  var scopes = ['playlist-modify-public', 'playlist-modify-private'];
  var state  = new Date().getTime();
  var authoriseURL = spotifyApi.createAuthorizeURL(scopes, state);
  res.redirect(authoriseURL);
});

app.get('/callback', function(req, res) {
  spotifyApi.authorizationCodeGrant(req.query.code)
    .then(function(data) {
      spotifyApi.setAccessToken(data.body['access_token']);
      spotifyApi.setRefreshToken(data.body['refresh_token']);
      return res.redirect('/');
    }, function(err) {
      return res.send(err);
    });
});



app.use('/store', function(req, res, next) {
  if (req.body.token !== process.env.SLACK_TOKEN) {
    return res.status(500).send('Cross site request forgerizzle!');
  }
  next();
});

app.post('/store', function(req, res) {
  spotifyApi.refreshAccessToken()
    .then(function(data) {
      spotifyApi.setAccessToken(data.body['access_token']);
      if (data.body['refresh_token']) {
        spotifyApi.setRefreshToken(data.body['refresh_token']);
      }
      if(req.body.text.indexOf(' - ') === -1) {
        var query = 'track:' + req.body.text;
      } else {
        var pieces = req.body.text.split(' - ');
        var query = 'artist:' + pieces[0].trim() + ' track:' + pieces[1].trim();
      }
      spotifyApi.searchTracks(query)
        .then(function(data) {
          var results = data.body.tracks.items;
          if (results.length === 0) {
            return res.send('Could not find that track.');
          }
          var track = results[0];
          spotifyApi.addTracksToPlaylist(process.env.SPOTIFY_USERNAME, process.env.SPOTIFY_PLAYLIST_ID, ['spotify:track:' + track.id])
            .then(function(data) {
              return res.send('Track added: *' + track.name + '* by *' + track.artists[0].name + '*');
            }, function(err) {
              return res.send(err.message);
            });
        }, function(err) {
          return res.send(err.message);
        });
    }, function(err) {
      return res.send('Could not refresh access token. You probably need to re-authorise yourself from your app\'s homepage.');
    });
});

app.use('/command', function(req, res, next) {
  if (req.body.token !== process.env.SLACK_TOKEN) {
    return res.status(500).send('Cross site request forgerizzle!');
  }
  next();
});


var HandlePlaylistCommand = function(req, res) {

};

var HandlePlayCommand = function(req, res) {
  var request = req.body.text;
  var space = request.indexOf(' ');
  var track = null;

  if (space != -1) {
    track = request.substring(space + 1, request.length);
    console.log("Searching Spotify for track: " + track);
  } else {
    var script = 'tell application "Spotify"\n\tplay\nend tell';
    applescript.execString(script, function(error, ret) {
      if (error) {
        console.log("Encountered an error while attempting to run command");
        console.log(error);
        return res.send("I had a problem resuming playback on Spoity, you should tell my creator to check the logs for errors.");
      } else {
        return res.send("Resumed playback successfully. Enjoy!");
      }
    });
  }

  var pieces = track.split('-');
  var track = pieces[pieces.length - 1];
  var artist = null;
  if (pieces.length > 1)
    artist = pieces[0];

  var query = "track:" + track.trim();
  if (artist)
    query = "artist:" + artist.trim() + " " + query;

  console.log(query);
  spotifyApi.searchTracks(query).then(function(data) {
    var results  = data.body.tracks.items;
    if (results.length === 0) {
      return res.send("I couldn't file that track. You must have some weird taste in music... No judgement though! Just kidding, judgement.");
    }

    var track = results[0];
    var trackId = track.id;
    var trackName = track.name;
    var artist = track.artists[0].name;
    console.log("Found track: %s by %s", trackName, artist);
    var script = 'tell application "Spotify"\n\tplay track "spotify:track:' + trackId + '"\nend tell';

    applescript.execString(script, function(error, rtn) {
      if (error) {
        return res.send("I had a problem playing that track. You should check what happened in the system logs or tell someone who knows how to.");
        console.log(error);
      } else {
        return res.send("Awesome selection! Playing: " + trackName + " by " + artist);
      }
    });
  }, function(error) {
    console.log("Spotify search error: ");
    console.log(error);
    return res.send("I encountered a problem while searching for that track. Tell my creator to check the logs.");
  });
};


app.post('/command', function(req, res) {
  console.log("");
  console.log("==== Starting new request ====");
  spotifyApi.refreshAccessToken().then(function(data) {
    var command = req.body.text;
    var firstSpace = command.indexOf(' ');
    var cmd = "";
    if (firstSpace === -1) {
      cmd = command;
    } else {
      cmd = command.substring(0, firstSpace).trim();
    }

    if (cmd === "play") {
      var request = req.body.text;
      var space = request.indexOf(' ');
      var track = null;

      if (space != -1) {
        track = request.substring(space + 1, request.length);
        console.log("Searching Spotify for track: " + track);
      } else {
        var script = 'tell application "Spotify"\n\tplay\nend tell';
        applescript.execString(script, function(error, ret) {
          if (error) {
            console.log("Encountered an error while attempting to run command");
            console.log(error);
            return res.send("I had a problem resuming playback on Spoity, you should tell my creator to check the logs for errors.");
          } else {
            return res.send("Resumed playback successfully. Party on Garth!");
          }
        });
      }

      var pieces = track.split('-');
      var track = pieces[pieces.length - 1];
      var artist = null;
      if (pieces.length > 1)
        artist = pieces[0];

      var query = "track:" + track.trim();
      if (artist)
        query = "artist:" + artist.trim() + " " + query;

      console.log(query);
      spotifyApi.searchTracks(query).then(function(data) {
        var results  = data.body.tracks.items;
        if (results.length === 0) {
          return res.send("I couldn't file that track. You must have some weird taste in music... No judgement though! Just kidding, judgement.");
        }

        var track = results[0];
        var trackId = track.id;
        var trackName = track.name;
        var artist = track.artists[0].name;
        console.log("Found track: %s by %s", trackName, artist);
        var script = 'tell application "Spotify"\n\tplay track "spotify:track:' + trackId + '"\nend tell';

        applescript.execString(script, function(error, rtn) {
          if (error) {
            return res.send("I had a problem playing that track. You should check what happened in the system logs or tell someone who knows how to.");
            console.log(error);
          } else {
            return res.send("Awesome selection! Playing: " + trackName + " by " + artist);
          }
        });
      }, function(error) {
        console.log("Spotify search error: ");
        console.log(error);
        return res.send("I encountered a problem while searching for that track. Tell my creator to check the logs.");
      });
    } else if (cmd === "pause") {
      var script = 'tell application "Spotify"\n\tpause\nend tell';
      applescript.execString(script, function(error, ret) {
        if (error) {
          console.log("Encountered an error while attempting to run command");
          console.log(error);
          return res.send("I had a problem pausing playback on Spoity, you should tell my creator to check the logs for errors.");
        } else {
          return res.send("Paused playback successfully. Come back and jam me soon!");
        }
      });
    } else if (cmd === "next") {
      var script = 'tell application "Spotify"\n\tnext track\nend tell';
      applescript.execString(script, function(error, ret) {
        if (error) {
          console.log("Encountered an error while attempting to run command");
          console.log(error);
          return res.send("I had a problem playing the next track on Spoity, you should tell my creator to check the logs for errors.");
        } else {
          return res.send("Skipped to the next track, keep on rollin' baby.");
        }
      });
    } else if (cmd === "prev") {
      var script = 'tell application "Spotify"\n\tprevious track\nend tell';
      applescript.execString(script, function(error, ret) {
        if (error) {
          console.log("Encountered an error while attempting to run command");
          console.log(error);
          return res.send("I had a problem playing the previous track on Spoity, you should tell my creator to check the logs for errors.");
        } else {
          return res.send("That track must have been tight. Turn up and jam it!");
        }
      });
    } else if (cmd === "youtube") {
      var request = req.body.text;
      var space = request.indexOf(' ');
      var video = null;

      if (space != -1) {
        video = request.substring(space + 1, request.length);
      } else {
        return res.send("For me to play a youtube video, I'll need you to tell me which one.");
      }

      var script = 'tell application "Google Chrome"\n\tactivate\n\topen location "' + video + '"\n\tdelay 1\n\tactivate\nend tell';
      console.log(script);
      applescript.execString(script, function(error, ret) {
        if (error) {
          console.log("Encountered an error while attempting to run command");
          console.log(error);
          return res.send("I had a problem playing that video for you, you should tell my creator to check the logs for errors.");
        } else {
          return res.send("Good choice, I'm playing that for you now.");
        }
      });
    }  else if (cmd === "echo") {
      // return HandleEchoCommand(req, res);
    } else if (cmd === "playlist") {
      var request = req.body.text;
      var space = request.indexOf(' ');
      var playlist = null;
      if (space != -1) {
        playlist = request.substring(space + 1, request.length);
      } else {
        return res.send("I'm not a mind reader. I need to know what playlist you're looking to hear.");
      }

      var pieces = playlist.split('|');
      var user = null;
      playlist = pieces[0].trim();
      if (pieces.length > 1) {
        user = pieces[1].trim();
      }

      spotifyApi.searchPlaylists(playlist).then(function(data) {
        var results = data.body.playlists.items;
        console.log("Found playlists");
        if (user) {
          console.log("Had user in query: %s", user);
          var playlistId = null;
          var uri = null;
          for(var i = 0; i < results.length; i++) {
            var item = results[i];
            if (results[i].owner.id.toString() === user) {
              playlistId = results[i].id;
              uri = results[i].uri;
            }
          }

          console.log("Playlist ID: %s, URI: %s", playlistId, uri);
          spotifyApi.getPlaylistTracks(user, playlistId).then(function(data) {
            var firstTrack = data.body.items[0].track.uri;
            console.log("Playing track: %s", firstTrack);
            var script = 'tell application "Spotify"\n\tplay track "' + firstTrack + '" in context "' + uri +'"\nend tell';
            console.log(script);
            applescript.execString(script, function(error, ret) {
              if (error) {
                console.log(error);
                return res.send("I had a problem playing that playlist. Tell my creator to check the logs.");
              } else {
                return res.send("I'm playing that playlist for you. Enjoy!");
              }
            });
          }, function(error) {
            console.log(error);
          });
        } else {
          if (results.length > 1) {
            console.log("Multiple playlists found");
            var result = "I found several playlists matching that title. Please select one and let me know with 'playlist {{name}} | {{user}}'.\n\nHere's a list:\n";
            var playlists = [];
            for(var i = 0; i < results.length; i++) {
              var item = results[i];
              var name = item.name;
              var owner = item.owner.id;
              playlists.push(name + " by " + owner);
              // result += results[i].name + " by " + results[i].owner.id;
              // result += ", ";
            }
            console.log(playlists);
            result += playlists.join("\n\n");
            console.log(result);
            // result = result.trimEnd(', ');
            // result += "]";
            // console.log(result);
            return res.send(result);
          } else if (results.length < 1) {
            return res.send("I'm sorry, I couldn't find any playlists like that.")
          } else { // Just play the playlist
            console.log("Only one playlist found");
            var playlist = results[0];
            var id = playlist.id;
            var uri = playlist.uri;
            var owner = playlist.owner.id;

            spotifyApi.getPlaylistTracks(owner, id).then(function(data) {
              var track = data.body.items[0].track.uri;
              var script = 'tell application "Spotify"\n\tplay track "' + track + '" in context "' + uri +'"\nend tell';
              applescript.execString(script, function(error, ret) {
                if (error) {
                  console.log(error);
                  return res.send("I had a problem playing that playlist. Tell my creator to check the logs.");
                } else {
                  return res.send("I'm playing that playlist for you. Enjoy!");
                }
              });
            });
          }
        }
      });
    } else {
      return res.send("I don't know how to handle that command. Maybe ask JT what the commands are before being a bafoon and requesting something I can't possibly do?");
    }
  }, function(err) {
    return res.send("Could not refresh access token. You probably need to re-authorize yourself from your app's home page.");
  });
});


app.set('port', (process.env.PORT || 5000));
app.listen(app.get('port'));
