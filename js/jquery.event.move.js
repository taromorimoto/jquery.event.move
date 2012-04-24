// jquery.event.move
//
// 0.8
//
// Stephen Band
//
// Triggers 'movestart', 'move' and 'moveend' events after
// mousemoves following a mousedown cross a distance threshold,
// similar to the native 'dragstart', 'drag' and 'dragend' events.
// Move events are throttled to animation frames. Move event objects
// have the properties:
//
// pageX:
// pageY:   Page coordinates of pointer.
// startX:
// startY:  Page coordinates of pointer at movestart.
// deltaX:
// deltaY:  Distance the pointer has moved since movestart.


(function(jQuery, undefined){
	var debug = true,

	    log = debug && window.console.log;

	var threshold = 3,
			
	    add = jQuery.event.add,
	   
	    remove = jQuery.event.remove,

	    // Just sugar, so we can have arguments in the same order as
	    // add and remove.
	    trigger = function(node, type, data) {
	    	jQuery.event.trigger(type, data, node);
	    },

			// Shim for requestAnimationFrame, falling back to timer. See:
			// see http://paulirish.com/2011/requestanimationframe-for-smart-animating/
			requestFrame = (function(){
				return (
					window.requestAnimationFrame ||
					window.webkitRequestAnimationFrame ||
					window.mozRequestAnimationFrame ||
					window.oRequestAnimationFrame ||
					window.msRequestAnimationFrame ||
					function(fn, element){
						return window.setTimeout(function(){
							fn(+new Date());
						}, 25);
					}
				);
			})(),
			
			ignoreTags = {
				textarea: true,
				input: true,
				select: true
			},
			
			mouseevents = {
				move: 'mousemove',
				cancel: 'mouseup dragstart',
				end: 'mouseup'
			},
			
			touchevents = {
				move: 'touchmove',
				cancel: 'touchend',
				end: 'touchend'
			};
	
	// CONSTRUCTORS
	
	function Timer(fn){
		var callback = fn,
				active = false,
				running = false;
		
		function trigger(time) {
			if (active){
				callback();
				requestFrame(trigger);
				running = true;
				active = false;
			}
			else {
				running = false;
			}
		};
		
		this.kick = function(fn) {
			active = true;
			if (!running) { trigger(+new Date()); }
		};
		
		this.end = function(fn) {
			var cb = callback;
			
			if (!fn) { return; }
			
			// If the timer is not running, simply call the end callback.
			if (!running) {
				fn();
			}
			// If the timer is running, and has been kicked lately, then
			// queue up the current callback and the end callback, otherwise
			// just the end callback.
			else {
				callback = active ?
					function(){ cb(); fn(); } : 
					fn ;
				
				active = true;
			}
		}
	}
	
	// FUNCTIONS
	
	function returnFalse(e) {
		return false;
	}
	
	function preventDefault(e) {
		e.preventDefault();
	}
	
	function preventIgnoreTags(e) {
		// Don't prevent interaction with form elements.
		if (ignoreTags[ e.target.tagName.toLowerCase() ]) { return; }
		
		e.preventDefault();
	}
	
	function identifiedTouch(touchList, id) {
		var i, l;
		
		if (touchList.identifiedTouch) {
			return touchList.identifiedTouch(id);
		}
		
		// touchList.identifiedTouch() does not exist in
		// webkit yet… we must do the search ourselves...
		
		i = -1;
		l = touchList.length;
		
		while (++i < l) {
			if (touchList[i].identifier === id) {
				return touchList[i];
			}
		}
	}
	

	// Handlers that decide when the first movestart is triggered
	
	function mousedown(e){
		// Respond only to mousedowns on the left mouse button
		if (e.which !== 1) { return; }

		add(document, mouseevents.move, mousemove, e);
		add(document, mouseevents.cancel, mouseend, e);
	}

	function mousemove(e){
		var touchstart = e.data,
		    touch = e,
		    distX, distY, node, data, event;

		checkThreshold(touchstart, touch, removeMouse);
	}

	function mouseend(e) {
		removeMouse();
	}

	function removeMouse() {
		remove(document, mouseevents.move, mousemove);
		remove(document, mouseevents.cancel, removeMouse);
	}

	function touchstart(e) {
		var touch;

		// Don't get in the way of interaction with form elements.
		if (ignoreTags[ e.target.tagName.toLowerCase() ]) { return; }

		touch = e.changedTouches[0];
			
		// Use the touch identifier as a namespace, so that we can later
		// remove handlers pertaining only to this touch.
		add(document, touchevents.move + '.' + touch.identifier, touchmove, touch);
		add(document, touchevents.cancel + '.' + touch.identifier, touchend, touch);
	}

	function touchmove(e){
		var touchstart = e.data,
		    touch = identifiedTouch(e.changedTouches, touchstart.identifier);
		
		// This isn't the touch you're looking for.
		if (!touch) { return; }

		checkThreshold(touchstart, touch, removeTouch);
	}

	function touchend(e) {
		var touchstart = e.data,
		    touch = identifiedTouch(e.changedTouches, touchstart.identifier);

		// This isn't the touch you're looking for.
		if (!touch) { return; }

		removeTouch(touchstart);
	}

	function removeTouch(touchstart) {
		remove(document, '.' + touchstart.identifier, touchmove);
		remove(document, '.' + touchstart.identifier, touchend);
	}

	// Logic for deciding when to trigger movestart.

	function checkThreshold(touchstart, touch, fn) {
		var distX = touch.pageX - touchstart.pageX,
		    distY = touch.pageY - touchstart.pageY,
		    node;

		// Do nothing if the threshold has not been crossed.
		if ((distX * distX) + (distY * distY) < (threshold * threshold)) { return; }

		return triggerStart(touchstart, touch, distX, distY, fn);
	}

	function triggerStart(touchstart, touch, distX, distY, fn) {
		var node = touchstart.target,
		    data, e;

		// Climb the parents of this target to find out if one of the
		// move events is bound somewhere. This is an optimisation that
		// may or may not be good. I should test.
		while (node !== document.documentElement) {
			data = jQuery.data(node, 'events');
			
			// Test to see if one of the move events has been bound.
			if (data && (data.movestart || data.move || data.moveend)) {

				e = jQuery.Event(touch);
				e.type = 'movestart';
				e.startX = touchstart.pageX;
				e.startY = touchstart.pageY;
				e.distX = distX;
				e.distY = distY;
				// This being the very first move event, dist and delta are equal.
				e.deltaX = distX;
				e.deltaY = distY;

				if (debug) { log('trigger movestart:', event); }

				trigger(touchstart.target, event);

				return fn();
			}
			
			node = node.parentNode;
		}
	}
	
	// Handlers that control what happens following a movestart
	
	function activeMousemove(e) {
		var obj = e.data.obj,
		    timer = e.data.timer,
		    events = e.data.events,
		    touch, pageX, pageY;
		
		// If more than one finger is down this is no longer a
		// move action.
		if (events === touchevents) {
			if (e.originalEvent.touches.length > 1) { return; }

			touch = e.originalEvent.touches[0];
			obj.pageX = touch.pageX;
			obj.pageY = touch.pageY;
		}
		else {
			obj.pageX = e.pageX;
			obj.pageY = e.pageY;
		}

		obj.deltaX = obj.pageX - obj.startX;
		obj.deltaY = obj.pageY - obj.startY;
		
		timer.kick();
		
		if (events === touchevents) {
			// Stop the touch interface from scrolling
			e.preventDefault();
		}
	}
	
	function activeMouseup(e) {
		var _e = e.originalEvent,
		    target = e.data.target,
		    obj = e.data.obj,
		    timer = e.data.timer,
		    events = e.data.events;
		
		// When fingers are still left on the surface, the
		// move action may not be finished yet.
		if (events === touchevents && (identifiedTouch(_e.touches, e.data.touchId))) { return; }
		
		remove(document, events.move, activeMousemove);
		remove(document, events.end, activeMouseup);
		
		timer.end(function(){
			obj.type = 'moveend';

			trigger(target, obj);
			
			if (events === mouseevents) {
				// Unbind the click suppressor, waiting until after mouseup
				// has been handled.
				setTimeout(function(){
					remove(target, 'click', returnFalse);
				}, 0);
			}
		});
	}
	
	function setup( data, namespaces, eventHandle ) {
		var elem = jQuery(this),
		    events = elem.data('events');
		
		// If another move event is already setup,
		// don't setup again.
		if (((events.movestart ? 1 : 0) +
		     (events.move ? 1 : 0) +
		     (events.moveend ? 1 : 0)) > 1) { return; }
		
		// Stop the node from being dragged
		add(this, 'dragstart.move drag.move', preventDefault);
		// Prevent text selection and touch interface scrolling
		add(this, 'mousedown.move touchstart.move', preventIgnoreTags);

		return true;
	}
	
	function teardown( namespaces ) {
		var elem = jQuery(this),
		    events = elem.data('events');
		
		// If another move event is still setup,
		// don't teardown just yet.
		if (((events.movestart ? 1 : 0) +
		     (events.move ? 1 : 0) +
		     (events.moveend ? 1 : 0)) > 1) { return; }
		
		remove(this, 'dragstart drag', preventDefault);
		remove(this, 'mousedown touchstart', preventIgnoreTags);

		return true;
	}
	
	
	// THE MEAT AND POTATOES
	
	add(document, 'mousedown.move', mousedown);
	add(document, 'touchstart.move', touchstart);
	
	jQuery.event.special.movestart = {
		setup: setup,
		teardown: teardown,
		_default: function(e) {
			var target = e.target,
					events = e._events || mouseevents,
					obj = {
						type: 'move',
				  	startX: e.startX,
				  	startY: e.startY,
				  	deltaX: e.pageX - e.startX,
				  	deltaY: e.pageY - e.startY
					},
					timer = new Timer(function(time){
						trigger(target, obj);
					}),
					data = {
						target: target,
						obj: obj,
						timer: timer,
						events: events,
						touchId: e._touchId
					},
					touch;
			
			if (events === mouseevents) {
				// Stop clicks from propagating during a move
				// Why? I can't remember, but it is important...
				add(e.target, 'click', returnFalse);
			}
			
			// Track pointer events
			add(document, events.move, activeMousemove, data);
			add(document, events.end, activeMouseup, data);
		}
	};
	
	jQuery.event.special.move = jQuery.event.special.moveend = {
		setup: setup,
		teardown: teardown
	};
	
})(jQuery);


// Make jQuery copy touch event properties over to the jQuery event
// object, if they are not already listed.

(function(jQuery, undefined){
	var props = ["touches", "targetTouches", "changedTouches"],
	    l = props.length;
	
	while (l--) {
		if (jQuery.event.props.indexOf(props[l]) === -1) {
			jQuery.event.props.push(props[l]);
		}
	}
})(jQuery);