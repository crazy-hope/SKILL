export const studioTheme = {
  // Separate React runtimes (including extensions) can reuse Ant Design's default key.
  cssVar: { key: "scene-forge-v19", prefix: "scene-forge" },
  token: {
    colorPrimary: "#345f48",
    colorInfo: "#345f48",
    colorSuccess: "#467856",
    colorText: "#263d31",
    colorTextSecondary: "#5b695f",
    colorBgLayout: "#f4f5ef",
    colorBgContainer: "#fffefa",
    colorBorder: "#d6dfd0",
    borderRadius: 9,
    fontSize: 14,
    controlHeight: 38,
    fontFamily:
      'Inter,-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif',
  },
  components: {
    Card: { headerFontSize: 16, bodyPadding: 18 },
    Modal: { titleFontSize: 18 },
    Button: { primaryShadow: "none" },
    Collapse: { headerBg: "transparent", contentBg: "transparent" },
    Form: { itemMarginBottom: 14, labelColor: "#60705c" },
    Input: { paddingBlock: 7, paddingInline: 12 },
    Select: { optionSelectedBg: "#e9f0e4" },
  },
};
