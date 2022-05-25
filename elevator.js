{
    init: function(elevators, floors) {

        const UP = 1;
        const DOWN = 2;
        const MAX_LOAD = 0.7; // for considering taking additional ppl

        var requestedPickups = [];

        function requestPickup(floorNum, dir) {
            const i = requestedPickups.findIndex(e => e.floor === floorNum)
            if (i == -1) {
                requestedPickups.push({floor: floorNum, dir: dir});
            } else {
                requestedPickups[i].dir |= dir
            }
            checkAvailableElevator();
        }

        function getNearest(arr, current) {
            var [floor, minDist, index] = [undefined, Infinity, undefined];
            for (const [i, val] of arr.entries()) {
                const dist = Math.abs(val - current);
                if (dist <  minDist) {
                    floor = val;
                    minDist = dist;
                    index = i;
                }
            }
            return [floor, minDist, index];
        }

        function popNearestPickup(current) {
            if (requestedPickups.length == 0)
                return undefined;

            let sorted = requestedPickups.filter(p => p.floor !== current).sort((a, b) => Math.abs(a.floor - current) - Math.abs(b.floor - current));
            return popValue(requestedPickups, sorted[0]);
        }

        function popValue(arr, value) {
            const i = arr.indexOf(value);
            if (i >= 0) {
                arr.splice(i, 1);
                return value;
            }
            return undefined;
        }

        function clearPickup(floor, dir) {
            const i = requestedPickups.findIndex(e => e.floor === floor)
            if (i >= 0) {
                requestedPickups[i].dir &= ~dir
            }
        }

        function setupElevator(elevator, index) {

            elevator.requestedFloors_ = new Set();
            elevator.destFloor_ = undefined;
            elevator.index_ = index;

            function log(msg) {
                console.log(`${elevator.index_}: ${msg}`);
            }

            elevator.setDest_ = function(floorNum) {
                elevator.destFloor_ = floorNum;
                if (floorNum !== undefined) {
                    let up = elevator.destFloor_ > elevator.currentFloor();
                    elevator.goingUpIndicator(up);
                    elevator.goingDownIndicator(!up);
                    log(`next dest ${elevator.destFloor_}, dir ${up ? "up": "down"}`);
                }
                else {
                    log("no next dest");
                    elevator.goingUpIndicator(true);
                    elevator.goingDownIndicator(true);
                }
            }

            elevator.dispatch_ = function(floorNum) {
                log(`dispatched from ${elevator.currentFloor()} to floor ${floorNum}`);
                elevator.goToFloor(floorNum);
            }

            elevator.on("floor_button_pressed", function(floorNum) {
                //log(`${floorNum} pressed`);
                elevator.requestedFloors_.add(floorNum);

                if (elevator.destFloor_ === undefined) {
                    elevator.setDest_(floorNum);
                }
            })

            elevator.on("stopped_at_floor", function(floorNum) {
                elevator.requestedFloors_.delete(floorNum);
                if (floorNum === elevator.destFloor_) {
                    log(`at dest ${floorNum}`);
                    let [nextDest] = elevator.requestedFloors_;
                    elevator.requestedFloors_.delete(nextDest);
                    elevator.setDest_(nextDest);
                } else {
                    log(`at floor ${floorNum}, dest ${elevator.destFloor_}`);
                }
                //clearPickup(floorNum, dir)
            })

            // Whenever the elevator is idle (has no more queued destinations) ...
            elevator.onIdle_ = function() {
                var floorNum = elevator.destFloor_;
                if (floorNum === undefined) {
                    [floorNum] = getNearest(elevator.getPressedFloors(), elevator.currentFloor());
                    if (floorNum !== undefined) {
                        log(`idle, going to nearest pressed ${floorNum}`)
                    }
                }
                if (floorNum === undefined) {
                    const pickup = popNearestPickup(elevator.currentFloor());
                    if (pickup) {
                        floorNum = pickup.floor
                        if (floorNum !== undefined) {
                            log(`idle, going to nearest pickup ${floorNum}`)
                        }
                    }
                }
                if (floorNum !== undefined) {
                    //log("idle, going to " + floorNum);
                    const up = floorNum > elevator.currentFloor();
                    elevator.goToFloor(floorNum);
                }
            };
            elevator.on("idle", elevator.onIdle_);

            elevator.on("passing_floor", function(floorNum, direction) {
                log(`passing floor ${floorNum}, LF=${elevator.loadFactor()}`);
                var stop = false;
                if (elevator.getPressedFloors().indexOf(floorNum) >= 0) {
                    log(`going to stop at pressed floor ${floorNum}`);
                    stop = true;
                } else if (elevator.loadFactor() <= MAX_LOAD && elevator.loadFactor() > 0.0) {
                    log(`Maybe stop at ${floorNum}`);
                    const dir = direction == "up" ? UP : DOWN;
                    var floors = requestedPickups.filter(p => (p.dir & dir) && p.floor === floorNum)
                    if (floors.length) {
                        stop = true;
                        clearPickup(floorNum, dir)
                    }
                }
                if (stop) {
                    elevator.goToFloor(floorNum, true);
                }
            });
        }

        for (const [i, elevator] of elevators.entries()) {
            setupElevator(elevator, i);
        }

        function checkAvailableElevator() {
            let avail = elevators.filter(e => e.loadFactor() == 0 && e.destinationQueue.length == 0);
            if (!avail.length) {
                return;
            }
            const pickup = requestedPickups.shift();
            if (!pickup) {
                return;
            }

            avail.sort((e1, e2) => Math.abs(e1.currentFloor() - pickup.floor) - Math.abs(e2.currentFloor() - pickup.floor));
            avail[0].dispatch_(pickup.floor);
        }

        floors.forEach(function(floor) {
            floor.on("up_button_pressed", function() {
                requestPickup(floor.floorNum(), UP);
            });
            floor.on("down_button_pressed", function() {
                requestPickup(floor.floorNum(), DOWN);
            });
        });
    },

    update: function(dt, elevators, floors) {
        // We normally don't need to do anything here
    }
}