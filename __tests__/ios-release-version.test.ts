import fs from "fs";
import path from "path";
import { describe, expect, it } from "@jest/globals";

const project = fs.readFileSync(
  path.join(__dirname, "../ios/AppFrontend.xcodeproj/project.pbxproj"),
  "utf8"
);

describe("next TestFlight release", () => {
  it("identifies the send-crash build as 1.2 (6)", () => {
    expect(project.match(/MARKETING_VERSION = 1\.2;/g)).toHaveLength(2);
    expect(project.match(/CURRENT_PROJECT_VERSION = 6;/g)).toHaveLength(2);
  });
});
