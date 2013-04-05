function Calendar(options) {
    this._entries = [];
    this._options = (options ? options : {});
    this._events = {
        onEventsAdded: []
    };
}

Calendar.prototype.setOptions = function(options) {
    for (var key in options) {
        this._options[key] = options[key];
    }
};

Calendar.prototype.getEntries = function() {
    return this._entries;
};

Calendar.prototype.onEventsAdded = function(callback) {
    this._events.onEventsAdded.push(callback);
};

Calendar.prototype.parseDate = function(dateStr) {
    var d = new Date(dateStr);
    if (!isNaN(d)) {
        return d;
    }
    // parse it like yyyy-mm-ddTHH:MM:SS
    return new Date(dateStr.substring(0, 4), dateStr.substring(5, 7), dateStr.substring(8, 10), dateStr.substring(11, 13), dateStr.substring(14, 16));
}

Calendar.prototype.loadFeed = function(options) {
    var thiz = this;

    this._loadURL(Calendar._calendarFeedURL(options), function(result) {
        var newEntries = [];

        for (var i = 0; i < result.feed.entry.length; i++) {
            var entry = result.feed.entry[i];
            var from = thiz.parseDate(entry.gd$when[0].startTime);
            var to = thiz.parseDate(entry.gd$when[0].endTime);
            newEntries.push({
                id: entry.id.$t,
                title : entry.title.$t,
                content: entry.content.$t,
                when: { from: from, to: to },
                link: entry.link[0].href,
                _definition: result

            });
        }

        thiz._entries.push.apply(thiz._entries, newEntries);

        thiz._events.onEventsAdded.forEach(function(callback) {
            callback(newEntries);
        });
    });
};

Calendar.prototype._loadURL = function(url, callback) {
    $.getJSON(url, callback);
};

Calendar._calendarFeedURL = function(options) {
    if (!options.calendarId) {
        throw new Error("Calendar ID must be specified");
    }

    var url = "http://www.google.com/calendar/feeds/" + options.calendarId + "/public/full?alt=json";

    if ("orderBy" in options) {
        url += "&orderby=" + options.orderBy;
    }

    if ("maxResults" in options) {
        url += "&max-results=" + options.maxResults;
    }

    if ("singleEvents" in options) {
        url += "&singleevents=" + options.singleEvents;
    }

    if ("sortOrder" in options) {
        url += "&sortorder=" + options.sortOrder;
    }

    if ("futureEvents" in options) {
        url += "&futureevents=true"
    }

    if ("callback" in options && options.callback) {
        url += "&callback=?"
    }

    // return "http://www.google.com/calendar/feeds/oarn29ir2vm2kjfaa5vof7qicg@group.calendar.google.com/public/full?alt=json&orderby=starttime&max-results=5&singleevents=true&sortorder=ascending&futureevents=true";

    return url;
};

function toConvenientDateFormat(date) {
    if (isNaN(date)) {
        return "";
    }
    var months = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];
    var pad = function(str, len, prefix) {
        while (str.length < len) {
            str = prefix + str;
        }

        return str;
    };

    return date.getDate() + (function() {
        var day = date.getDate();

        if (day >= 10 && day <= 20) {
            return ":e";
        }

        switch (day % 10) {
            case 1:
            case 2:
                return ":a";
            default:
                return ":e";
        }
    })() + " " + months[date.getMonth()] + (function() { 
                                                if (date.getHours() > 0) {
                                                        return " " + pad(date.getHours().toString(), 2, "0") + ":" + pad(date.getMinutes().toString(), 2, "0");
                                                } else return "";})();
}

function cutStringIfNecessary(str, maxLength, suffix) {
    if (!str) {
        return "";
    }
    if (str.length < maxLength) {
        return str;
    }

    var done = false;

    str = str.substring(0, maxLength);

    for (var i = str.length - 1; i >= 0 && !done; i--) {
        switch (str.charAt(i)) {
            case ' ':
            case '\t':
            case '\n':
            case '\r':
                str = str.substring(0, i);
                done = true;
        }
    }

    if (suffix) {
        str = str + suffix;
    }

    return str;
}

Calendar.prototype.displayWithRandomizedLayout = function(container, options) {
    if (container == null) {
        throw new Error("A valid container must be provided");
    }

    var eventViews = {};
    var thiz = this;

    var attachToEvent = function(event) {
        var content = $("<div>").addClass("content")
            .append($("<div>").addClass("title").text(event.title))
            .append($("<div>").text(cutStringIfNecessary(event.content, 200, " [...]")));

        if (event.when) {
            content.append($("<div>").addClass("time").text(toConvenientDateFormat(event.when.from)));
        }

        var eventView = $("<div>")
            .addClass("aptitud-calendar-event ie-aptitud-calendar-event")
            .css("position", "absolute")
            .append(content);

        if (options.onClick) {
            eventView.mousedown(function() {
                options.onClick({ event: event, view: eventView });
            });
        }

        eventViews[event.id] = eventView.get(0);

        /*rotate(eventView.get(0), nextRandom(-3, 3));*/

        $(container).append(eventView);

        createSticker(eventView.get(0));
    };

    var updateLayout = function() {
        var containerSize = {
            width: $(container).width(),
            height: $(container).height()
        };

        var landscape = (containerSize.width > containerSize.height);
        var offsetX = 0;
        var previousView = null;
        var maxWidth = containerSize.width / thiz._entries.length;
        var maxY = 0;

        for (var i = 0; i < thiz._entries.length; i++) {
            var entry = thiz._entries[i];
            var view = eventViews[entry.id];

            $(view)
                .css("left", offsetX + "px")
                .css("top", (
                    previousView == null
                        ? 0
                        : (i % 2 == 0
                            ? Math.max($(previousView).position().top - $(view).height() - (landscape ? nextRandom(40, 80) : nextRandom(20, 50)), 0)
                            : $(previousView).position().top + $(previousView).height() + (landscape ? nextRandom(40, 80) : nextRandom(80, 120))
                        )
                ) + "px");

            previousView = view;

            offsetX += Math.min($(view).width(), maxWidth) - 20;

            maxY = Math.max(maxY, $(view).position().top + $(view).height());
        }

        //$(container).css("min-height", (maxY + 50) + "px");
    };

    this.onEventsAdded(function(events) {
        events.forEach(attachToEvent);
        updateLayout();
    });

    this._entries.forEach(function(entry) {
        attachToEvent(entry)
    });

    updateLayout();

    onLayoutRequested(updateLayout);
};