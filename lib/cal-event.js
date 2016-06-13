'use strict';

const fs = require('fs');
const _ = require('lodash');
const path = require('path');

const TMPDIR = require('os').tmpdir();

// Helpers
function formatDateTimeStamp(date) {
  const formatted = date.toISOString()
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

  const start = options.dtstart ? new Date(options.dtstart) : new Date();
  const end = start.setHours(start.getHours() + 2);

  return formatDateTimeStamp(new Date(end));
}

function getOrganizer(options) {
  let organizer = false;
  const org = options.organizer;
  const organizerIsValid = org && org.email && org.name;
  if (organizerIsValid) {
    organizer = {
      name: org.name,
      email: org.email,
    };
  }

  return organizer;
}

function getAttendees(options) {
  let attendees = false;
  const att = options.attendees;
  const attendeesIsValid = att && att[0].email && att[0].name;
  if (attendeesIsValid) {
    attendees = options.attendees;
  }

  return attendees;
}

function setFileExtension(dest) {
  return dest.slice(-4) === '.ics' ? dest : dest.concat('.ics');
}

// CalEvent prototype
function CalEvent(options) {
  const opt = options || {};
  this._init(opt);
  this._create();
}

CalEvent.prototype._init = (options) => {
  if (!options.events) {
    throw new Error('No events given');
  }
  // casting to array if it is no already array
  if (!_.isArray(options.events)) {
    options.events = [options.events];
  }
  this.numberOfEvents = options.events.length;
  options.events.forEach((op, i) => {
    const index = 'event' + i;
    this[index] = {};
    this[index].dtstamp = getDTStamp(op);
    this[index].organizer = getOrganizer(op);
    this[index].dtstart = getDTStart(op);
    this[index].dtend = getDTEnd(op);
    this[index].summary = op.eventName || 'New Event';
    this[index].description = op.description || false;
    this[index].location = op.location || false;
    this[index].attendees = getAttendees(op);
  });
};

CalEvent.prototype._create = () => {
  const props = [];

  props.push('BEGIN:VCALENDAR');
  props.push('VERSION:2.0');
  for (let i = 0; i < this.numberOfEvents; i++) {
    const index = 'event' + i;
    props.push('BEGIN:VEVENT');
    props.push('DTSTAMP:' + this[index].dtstamp);

    if (this[index].organizer) {
      let organizer = 'ORGANIZER;CN=' + this[index].organizer.name;
      organizer += ':MAILTO:' + this[index].organizer.email;
      props.push(organizer);
    }

    if (this[index].attendees) {
      this[index].attendees.forEach((obj) => {
        function check(type) { return type ? 'TRUE' : 'FALSE'; }
        const attendee = 'ATTENDEE;CN="' + obj.name + '";RSVP=' + check(obj.rsvp || false) + ':mailto:' + obj.email;
        props.push(attendee);
      });
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
};

CalEvent.prototype.getEvent = () => {
  return this.formattedICSFile;
};

function getEvent(options) {
  return new CalEvent(options).formattedICSFile;
}

function createEvent(opt, filepath, cb) {
  let dest;
  const options = opt || {};
  const cal = new CalEvent(options);
  const data = cal.getEvent();

  if (filepath) {
    dest = path.join(filepath, options.filename);
  } else if (options.filename) {
    dest = setFileExtension(path.join(TMPDIR, options.filename));
  } else {
    dest = path.join(TMPDIR, 'calendar-event.ics');
  }

  fs.writeFile(dest, data, (err) => {
    if (err) {
      return cb(err);
    }
    return cb(null, dest);
  });
}

module.exports = {
  createEvent: createEvent,
  getEvent: getEvent,
};
