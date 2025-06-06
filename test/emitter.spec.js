import Emitter from "../src/emitter.js";
import chai from "chai";

const expect = chai.expect;

describe("Emitter", () => {
  let emitter;
  beforeEach(() => {
    emitter = new Emitter();
  });

  it("should emit without listeners", () => {
    emitter.emit("no-listeners");
  });

  it("should not register non-functions", () => {
    emitter.on("no-func", 1);
  });

  it("should not throw when removing unexisting", () => {
    emitter.off("no-exist", () => {});
    emitter.on("no-exist-key", () => {});
    emitter.off("no-exist-key", () => {});
  });

  it("should emit and listen", (done) => {
    emitter.on("event", () => {
      done();
    });
    emitter.emit("eventType", "event");
  });

  it("should listen all", (done) => {
    emitter.on("*", () => {
      done();
    });
    emitter.emit("eventType", "special-event");
  });

  it("should remove listeners", (done) => {
    let a = 0;
    let cb = () => {
      a = 1;
      done(new Error("listener not removed"));
    };

    emitter.on("a", cb);
    emitter.off("a", cb);
    emitter.emit("eventType", "a");

    expect(a).to.equal(0);
    done();
  });
});
