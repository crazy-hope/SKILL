import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "antd";
import { WorkbenchTheme } from "./WorkbenchTheme.jsx";
import Workbench from "./App.jsx";
import "./styles.css";
createRoot(document.getElementById("root")).render(
  <WorkbenchTheme>
    <App>
      <Workbench />
    </App>
  </WorkbenchTheme>,
);
