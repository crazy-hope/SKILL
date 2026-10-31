import React from "react";
import { ConfigProvider, Button, Tag, Alert, Space } from "antd";
import zhCN from "antd/locale/zh_CN";
import { useWorkbench } from "./useWorkbench.js";
import { studioTheme } from "./theme.js";
import { BriefEditor } from "./components/BriefEditor.jsx";
import { Results } from "./components/Results.jsx";
import { SettingsModal } from "./components/SettingsModal.jsx";
import { RecordsModal } from "./components/RecordsModal.jsx";
import "./style.css";
export default function App() {
  const w = useWorkbench();
  return (
    <ConfigProvider theme={studioTheme} locale={zhCN}>
      <div className="studio">
        <header className="topbar">
          <a className="brand" href="#top">
            <span className="brand-mark">景</span>
            <span>
              画面工作台<small>SCENE FORGE / 19</small>
            </span>
          </a>
          <Space wrap className="top-actions">
            {w.output.status !== "idle" && (
              <Button onClick={w.openOutput}>
                {w.output.status === "loading" ? "查看生成进度" : "查看提示词"}
              </Button>
            )}
            <Button type="text" onClick={() => w.setDialog("records")}>
              记录与备份 <Tag>{w.data.history.length}</Tag>
            </Button>
            <Button onClick={() => w.setDialog("config")}>接口设置</Button>
          </Space>
        </header>
        <main id="top">
          <div className="intro">
            <div>
              <h1>先定基调，再描绘内容。</h1>
              <p>
                五项设定都可以修改。写下画面中的主体，或让 AI
                帮你把细节描述完整。
              </p>
            </div>
            <Tag>{w.config ? "规范 V16" : "连接本地服务…"}</Tag>
          </div>
          {w.storageError && !w.dialog && (
            <Alert
              className="feedback"
              type="warning"
              showIcon
              title={w.storageError}
              action={
                <Button size="small" onClick={() => w.setDialog("records")}>
                  处理记录
                </Button>
              }
            />
          )}
          {w.message && !w.dialog && (
            <Alert
              className="feedback"
              role="status"
              type="info"
              showIcon
              title={w.message}
            />
          )}
          {w.questions.length > 0 && w.dialog !== "results" && (
            <Alert
              className="feedback"
              type="warning"
              showIcon
              title="有几项设定需要统一"
              description={
                <>
                  <ul>
                    {w.questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                  请修改对应段落后重新生成。
                </>
              }
            />
          )}
          <BriefEditor w={w} />
          <footer>
            画面工作台 V19 <span>·</span> 主体细节与五项基调共同决定画面
          </footer>
        </main>
        <Results w={w} />
        <SettingsModal w={w} />
        <RecordsModal w={w} />
      </div>
    </ConfigProvider>
  );
}
