var fs = require('fs');
var _ = require('lodash');
var path = require('path');

var TMPDIR = require('os').tmpdir();

// Helpers
function formatDateTimeStamp(date) {
  var formatted = date.toISOString()
    .replace(/-|:/g, '')
    .slice(0, 13)
    .concat('00Z');

  return formatted;
}

function getDTStamp(options) {
  if (options.dtstamp) {
    return formatDateTimeStamp(new Date(options.dtstamp));
  }

  return formatDateTimeStamp(new Date());
}

function getDTStart(options) {
  if (options.dtstart) {
    return formatDateTimeStamp(new Date(options.dtstart));
  }

  return formatDateTimeStamp(new Date());
}

function getDTEnd(options) {
  if (options.dtend) {
    return formatDateTimeStamp(new Date(options.dtend));
  }

  var start = options.dtstart ? new Date(options.dtstart) : new Date();
  var end = start.setHours(start.getHours() + 1)

  return formatDateTimeStamp(new Date(end));
}

function getOrganizer(options) {
  var organizer = false;
  var org = options.organizer;
  var organizerIsValid = org && org.email && org.name;
  if (organizerIsValid) {
    organizer = {
      name: org.name,
      email: org.email
    };
  }

  return organizer;
}

function getAttendees(options){
  var attendees = false;
  var att = options.attendees;
  var attendeesIsValid = att && att[0].email && att[0].name;
  if (attendeesIsValid) {
    attendees = options.attendees
  }

  return attendees;
}

function setFileExtension(dest) {
  return dest.slice(-4) === '.ics' ? dest : dest.concat('.ics');
}

// CalEvent prototype
function CalEvent(options) {
  var options = options || {};
  this._init(options);
  this._create();
}

CalEvent.prototype._init = function(options) {
  // casting to array if it is no already array
  if (!_.isArray(options)) {
    options = [options];
  }
  this.numberOfEvents = options.length;
  options.forEach(function(op, index) {
    this[index].dtstamp = getDTStamp(op);
    this[index].organizer = getOrganizer(op);
    this[index].dtstart = getDTStart(op);
    this[index].dtend = getDTEnd(op);
    this[index].summary = op.eventName || 'New Event';
    this[index].description = op.description || false;
    this[index].location = op.location || false;
    this[index].attendees = getAttendees(op);
  });
}

CalEvent.prototype._create = function() {
  var props = [];

  props.push('BEGIN:VCALENDAR');
  props.push('VERSION:2.0');

  for (var index = 0; index < this.numberOfEvents; index++) {
    props.push('BEGIN:VEVENT');
    props.push('DTSTAMP:' + this[index].dtstamp);

    if (this[index].organizer) {
      var organizer = 'ORGANIZER;CN=' + this[index].organizer.name;
      organizer += ':MAILTO:' + this[index].organizer.email;
      props.push(organizer);
    }

    if (this[index].attendees){
      this[index].attendees.forEach(function(obj){
        function check(type) { return type ? 'TRUE' : 'FALSE'; }
        var attendee = 'ATTENDEE;CN="' + obj.name + '";RSVP=' + check(obj.rsvp || false) + ':mailto:' + obj.email;
        props.push(attendee);
      })
    }
    props.push('DTSTART:' + this[index].dtstart);
    props.push('DTEND:' + this[index].dtend);
    if (this[index].location) {
      props.push('LOCATION:' + this[index].location);
    }
    if (this[index].description) {
      props.push('DESCRIPTION:' + this[index].description);
    }
    props.push('SUMMARY:' + this[index].summary);
    props.push('END:VEVENT');
  }

  props.push('END:VCALENDAR');

  this.formattedICSFile = props.join('\r\n');
}

CalEvent.prototype.getEvent = function() {
  return this.formattedICSFile;
};

function getEvent(options) {
  return new CalEvent(options).formattedICSFile;
}

function createEvent(options, filepath, cb) {
  var dest;
  var options = options || {};
  var cal = new CalEvent(options);
  var data = cal.getEvent();

  if (filepath) {
    dest = path.join(filepath);
  } else if (options.filename) {
    dest = setFileExtension(path.join(TMPDIR, options.filename));
  } else {
    dest = path.join(TMPDIR, 'calendar-event.ics');
  }

  fs.writeFile(dest, data, function(err) {
    if (err) { return cb(err) };
    return cb(null, dest);
  });
}

module.exports = {
  createEvent: createEvent,
  getEvent: getEvent
}
