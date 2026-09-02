import fs from "fs";
import path from "path";
import { describe, expect, it } from "@jest/globals";

const project = fs.readFileSync(
  path.join(__dirname, "../ios/AppFrontend.xcodeproj/project.pbxproj"),
  "utf8"
);

describe("next TestFlight release", () => {
  it("identifies the kink-heart persist build as 1.2 (8)", () => {
    expect(project.match(/MARKETING_VERSION = 1\.2;/g)).toHaveLength(2);
    expect(project.match(/CURRENT_PROJECT_VERSION = 8;/g)).toHaveLength(2);
  });
});
