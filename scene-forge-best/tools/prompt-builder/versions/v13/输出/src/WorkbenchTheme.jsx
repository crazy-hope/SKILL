import React from "react";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";

export function WorkbenchTheme({ children }) {
  return (
    <ConfigProvider
      button={{ autoInsertSpace: false }}
      locale={zhCN}
      theme={{
        // Extensions can restart a separate React useId counter at the same value.
        cssVar: { key: "scene-forge-v13", prefix: "scene-forge" },
        token: {
          colorPrimary: "#376653",
          colorInfo: "#376653",
          colorText: "#26362e",
          colorTextSecondary: "#748077",
          colorBorder: "#dce2d9",
          colorBgLayout: "#f6f7f2",
          borderRadius: 8,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif',
          controlHeight: 32,
          fontSize: 13,
        },
        components: {
          Button: { primaryShadow: "none" },
          Select: { optionSelectedBg: "#e6eee5" },
          Drawer: { footerPaddingInline: 24 },
          Modal: { titleFontSize: 20 },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
