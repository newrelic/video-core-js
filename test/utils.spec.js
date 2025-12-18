import { getObjectEntriesForKeys } from "../src/utils.js";
import Log from "../src/log.js";
import chai from "chai";

const expect = chai.expect;

describe("Utils", () => {
  before(() => {
    Log.level = Log.Levels.SILENT;
  });

  after(() => {
    Log.level = Log.Levels.ERROR;
  });

  describe("getObjectEntriesForKeys", () => {
    it("should return object with only specified keys", () => {
      const obj = {
        name: "John",
        age: 30,
        city: "NYC",
        country: "USA",
        occupation: "Developer"
      };

      const keys = ["name", "city", "occupation"];
      const result = getObjectEntriesForKeys(keys, obj);

      expect(result).to.be.an("object");
      expect(result).to.have.property("name", "John");
      expect(result).to.have.property("city", "NYC");
      expect(result).to.have.property("occupation", "Developer");
      expect(result).to.not.have.property("age");
      expect(result).to.not.have.property("country");
    });

    it("should handle empty keys array", () => {
      const obj = {
        name: "John",
        age: 30,
        city: "NYC"
      };

      const result = getObjectEntriesForKeys([], obj);

      // Should return the original object when keys array is empty
      expect(result).to.equal(obj);
    });

    it("should handle non-existent keys", () => {
      const obj = {
        name: "John",
        age: 30
      };

      const keys = ["name", "nonExistentKey", "anotherMissingKey"];
      const result = getObjectEntriesForKeys(keys, obj);

      expect(result).to.be.an("object");
      expect(result).to.have.property("name", "John");
      expect(result).to.not.have.property("nonExistentKey");
      expect(result).to.not.have.property("anotherMissingKey");
      expect(result).to.not.have.property("age");
    });

    it("should handle null/undefined inputs", () => {
      const obj = {
        name: "John",
        age: 30
      };

      // Test null keys
      let result = getObjectEntriesForKeys(null, obj);
      expect(result).to.equal(obj);

      // Test undefined keys
      result = getObjectEntriesForKeys(undefined, obj);
      expect(result).to.equal(obj);

      // Test null object
      result = getObjectEntriesForKeys(["name"], null);
      expect(result).to.deep.equal({});

      // Test undefined object
      result = getObjectEntriesForKeys(["name"], undefined);
      expect(result).to.deep.equal({});

      // Test both null
      result = getObjectEntriesForKeys(null, null);
      expect(result).to.be.null;

      // Test non-array keys
      result = getObjectEntriesForKeys("notAnArray", obj);
      expect(result).to.equal(obj);
    });

    it("should preserve values correctly", () => {
      const obj = {
        string: "test",
        number: 42,
        boolean: true,
        nullValue: null,
        undefinedValue: undefined,
        array: [1, 2, 3],
        nested: { a: 1, b: 2 }
      };

      const keys = ["string", "number", "boolean", "nullValue", "undefinedValue", "array", "nested"];
      const result = getObjectEntriesForKeys(keys, obj);

      expect(result.string).to.equal("test");
      expect(result.number).to.equal(42);
      expect(result.boolean).to.equal(true);
      expect(result.nullValue).to.be.null;
      expect(result.undefinedValue).to.be.undefined;
      expect(result.array).to.deep.equal([1, 2, 3]);
      expect(result.nested).to.deep.equal({ a: 1, b: 2 });
    });

    it("should not mutate original object", () => {
      const obj = {
        name: "John",
        age: 30,
        city: "NYC"
      };

      const originalObj = JSON.parse(JSON.stringify(obj));
      const keys = ["name", "city"];

      const result = getObjectEntriesForKeys(keys, obj);

      // Modify result
      result.name = "Jane";
      result.newKey = "newValue";

      // Original should remain unchanged
      expect(obj).to.deep.equal(originalObj);
      expect(obj.name).to.equal("John");
      expect(obj).to.not.have.property("newKey");
    });

  });
});
