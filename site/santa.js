var santa = (function($) {
  // When running on localhost, there are some things we do differently.
  // For example, we upload Santa's location to the local web server rather than S3.
  var IS_LOCAL = window.location.hostname === "localhost" || window.location.hostname == "127.0.0.1";

  // By default only enable console output when running locally
  var DEBUG_ENABLED = IS_LOCAL;

  // Controls how frequently Santa's location gets updated as well as how frequently
  // it gets refreshed on end user's devices.
  var REFRESH_SECONDS = 3;

  // After the event has finished, keep it displayed on the site for this long
  // (with a message indicating it has finished).
  var FINISHED_EVENTS_VISIBLE_FOR_HOURS = 6;

  // If we haven't got an update of Santa's location for this long, we consider
  // him gone and don't show him on the map anymore (and if the event
  // has already started, consider it finished).
  var CONSIDER_SANTA_GONE_IF_NO_UPDATE_FOR_MINUTES = 15;

  // Santa can start his run this many minutes before the event's posted time.
  // If he starts before this, he won't show up on the map.
  var EVENT_START_LEEWAY_MINUTES = 15;


  function log(msg) {
    if (DEBUG_ENABLED) { console.log.apply(console, arguments); }
  }

  function error(msg) {
    if (DEBUG_ENABLED) { console.error.apply(console, arguments); }
  }

  // Extracts a named param from the URL
  function _getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  }

  // Get the AWS credentials from the URL and configure the AWS SDK.
  // This is used to upload Santa's current location to S3.
  function _getCredentials() {
    id = _getParameterByName("id");
    secret = _getParameterByName("secret");
    if (id !== null && secret !== null) {
      AWS.config.update({accessKeyId: id, secretAccessKey: secret});
      AWS.config.region = santa_config.region;
      return {
        id: id,
        secret: secret
      }
    } else {
      return null;
    }
  }

  // Gets the list of events (see events.js), filtered to only those that are in the future and sorted by date
  function _getEvents() {
    var currentTime = new Date().getTime();
    return santa_events.filter(function(e) {
      return Date.parse(e.start_time) >= currentTime - (FINISHED_EVENTS_VISIBLE_FOR_HOURS*60*60*1000);
    }).sort(function(a, b) {
      return a.start_time - b.start_time;
    });
  }

  // Returns a user friendly string representing the period of time until the given date.
  // Eg: "23 days"
  function _timeTill(date) {
    var seconds = Math.floor((date - new Date()) / 1000);
    var interval = Math.floor(seconds / 31536000);

    if (interval > 1) {
        return interval + " years";
    }
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) {
        return interval + " months";
    }
    interval = Math.floor(seconds / 86400);
    if (interval > 1) {
        return interval + " days";
    }
    interval = Math.floor(seconds / 3600);
    if (interval > 1) {
        return interval + " hours";
    }
    interval = Math.floor(seconds / 60);
    if (interval > 1) {
        return interval + " minutes";
    }
    return Math.floor(seconds) + " seconds";
  }

  // Returns a string representing Santa's current status based on the current time
  // the start time of the current event and when Santa was last seen.
  function _santaStatus(eventTime, lastSantaUpdateTime) {
    var currentTime = new Date().getTime();
    var santaSeenRecently = lastSantaUpdateTime && (currentTime - lastSantaUpdateTime) < CONSIDER_SANTA_GONE_IF_NO_UPDATE_FOR_MINUTES*60*1000;
    var santaSeenSinceEventStarted = lastSantaUpdateTime && lastSantaUpdateTime >= eventTime;
    var eventStarted = currentTime >= eventTime;
    var eventNearlyStarted = currentTime >= (eventTime - EVENT_START_LEEWAY_MINUTES*60*1000);
    var status = null;

    if (eventStarted && !santaSeenSinceEventStarted) {
      status = "Santa is harnessing up his reindeer and will be here soon!";
    } else if (eventStarted && santaSeenSinceEventStarted && !santaSeenRecently) {
      status = "Santa has finished for the day, see you next time!";
    } else if (eventNearlyStarted && santaSeenRecently) {
      status = "Santa is in town! You can find him on the map below.";
    } else {
      if (!eventStarted) {
        status = "Only " + _timeTill(Date.parse(data.currentEvent.start_time)) + " to go until Santa's visit!";
      } else {
        status = "Santa is back in the North Pole. See you next year!"
      }
    }

    log("santaStatus:", "santaStatus:", "eventTime " + eventTime, "currentTime " + currentTime, "lastSantaUpdateTime " + lastSantaUpdateTime, "santaSeenRecently " + santaSeenRecently, "santaSeenSinceEventStarted " + santaSeenSinceEventStarted, "eventStarted " + eventStarted, "eventNearlyStarted " + eventNearlyStarted, "santaStatus: ", status);
    return status;
  }

  // Refreshes the current location of Santa on the user's device
  function _refreshSantaLocation() {
    $.ajax({
      url: "/live/" + data.currentEvent.id + ".json?uuid=" + Math.random().toString(),
      type: "GET",
      success: function(result) {
        var loc = result;
        if (typeof loc === 'string') {
          loc = JSON.parse(result);
        }

        log("refreshSantaLocation: " + data.currentEvent.id + ": " + JSON.stringify(loc));
        var lastSantaUpdateTime = loc.time;
        var currentTime = new Date().getTime();
        var timeSinceSantaSeen = currentTime - lastSantaUpdateTime;
        var santaGone = timeSinceSantaSeen > CONSIDER_SANTA_GONE_IF_NO_UPDATE_FOR_MINUTES*60*1000;
        data.status = _santaStatus(Date.parse(data.currentEvent.start_time), lastSantaUpdateTime);
        if (!santaGone) {
          data.santaMarker.setPosition(loc);
        } else {
          log("Santa gone");
          data.santaMarker.setPosition(null);
        }
      },
      error: function(jqXHR, textStatus, err) {
        error("refreshSantaLocation: Error: " + err);
        data.status = _santaStatus(Date.parse(data.currentEvent.start_time), null);
        data.santaMarker.setPosition(null);
      }
    });
  }

  // Refreshes the end user's current location on the map
  function _refreshCurrentLocation() {
    if(navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        data.myMarker.setPosition({lat: position.coords.latitude, lng: position.coords.longitude});
      });
    }
  }

  // Upload's Santa's current location to the server (S3 in production, or POST to localhost if running locally)
  function _setSantaLocation() {
    if(navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        if (data.tracking) {
          var eventId = data.currentEvent.id;
          var now = new Date();
          var loc = {lat: position.coords.latitude, lng: position.coords.longitude, time: now.getTime()};
          var locString = JSON.stringify(loc);
          var url = "live/" + eventId + ".json";
          log("setSantaLocation: Update santa location " + eventId + ": " + locString);
          data.lastSantaLocationUpdate = "lat " + position.coords.latitude + ", lng " + position.coords.longitude + ", time " + now.toLocaleTimeString();
          if (IS_LOCAL) {
            // App is running locally - post the location to localhost
            $.ajax(url, {
              type: "POST",
              data: locString,
              error: function(xhr, status, err) {
                error("setSantaLocation: Error updating santa location: " + status + " - " + err);
                data.error = "Unable to update Santa's location: " + status + " - " + err;
              }
            });
          } else {
            // App is running in AWS - upload location to S3
            var s3 = new AWS.S3();
            s3.putObject({
              Bucket: santa_config.bucket,
              Key: url,
              Body: locString,
              ACL: "public-read"
            }, function(err, result) {
              if (err) {
                error("setSantaLocation: Error updating santa location: " + err);
                data.error = "Unable to update Santa's location: " + err;
              }
            });
          }
        }
      }, function(err) {
        data.error = err.message;
      });
    } else {
      data.error = "Unable to determine your current location";
    }
  }

  // Initialise the Google map with the KML file of the current event.
  // Also serves as a general init method for the app.
  var initMap = function() {
    // Add deploy_id query param to force maps refresh after deploy
    var kmlUrl = "https://www.google.com/maps/d/kml?mid=" + data.currentEvent.id + "&santa_id" + santa_config.deploy_id;
    var map = map = new google.maps.Map(document.getElementById('map'));
    data.map = map;
    data.santaMarker = new google.maps.Marker({
      clickable: false,
      icon: {
        url: "/assets/santa_marker.png",
        size: new google.maps.Size(40, 47),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(20, 40)
      },
      shadow: null,
      zIndex: 910,
      map: data.map
    });

    data.myMarker = new google.maps.Marker({
      icon: new google.maps.MarkerImage('//maps.gstatic.com/mapfiles/mobile/mobileimgs2.png',
                                        new google.maps.Size(22,22), new google.maps.Point(0,18), new google.maps.Point(11,11)),
      clickable: false,
      shadow: null,
      zIndex: 900,
      map: data.map
    });

    var kmlLayer = new google.maps.KmlLayer(kmlUrl, {
      map: map,
      preserveViewport: false,
      suppressInfoWindows: true,
    });

    // Recurring loop to refresh Santa's and the current user's location
    (function updateSanta(){
      _refreshCurrentLocation();
      _refreshSantaLocation();
      setTimeout(updateSanta, REFRESH_SECONDS * 1000);
    })();
  };

  // Sets the "current" event in response to a user clicking a button
  var setCurrentEvent = function(index) {
    var newEvent = data.events[index];
    if (newEvent.id !== data.currentEvent.id) {
      data.tracking = false;
      data.lastSantaLocationUpdate = null;
      data.currentEvent = newEvent;
      initMap();
    }
  };

  // Starts tracking Santa - called only on Santa's device
  var startTracking = function() {
    if (!data.tracking) {
      data.tracking = true;

      // Recurring loop to update Santa's current location on the server
      (function updateTracking() {
        if (data.tracking) {
          _setSantaLocation();
          setTimeout(updateTracking, REFRESH_SECONDS * 1000);
        }
      })();
    }
  };

  // Stops tracking Santa - called only on Santa's device
  var stopTracking = function() {
    data.tracking = false;
  };

  // Object holding the Vue UI state
  var data = {
    events: _getEvents(),
    currentEvent: _getEvents()[0],
    credentials: _getCredentials(),
    tracking: false,
    status: null,
    error: null,
    lastSantaLocationUpdate: null
  };

  // The Vue instance
  var vue = new Vue({
    el: '#santa',
    data: data,
    methods: {
      initMap: initMap,
      setCurrentEvent: setCurrentEvent,
      startTracking: startTracking,
      stopTracking: stopTracking
    }
  });

  // Fixes google maps height when it's inside a div
  $(window).resize(function () {
    var h = $(window).height();
    var offsetTop = 250;
    $('#map').css('height', (h - offsetTop));
  }).resize();


  return vue;

})(window.jQuery);
