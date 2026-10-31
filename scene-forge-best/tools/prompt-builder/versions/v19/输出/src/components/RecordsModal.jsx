import React, { useRef } from "react";
import { Modal, Button, Space, Alert, Empty, Card, Typography } from "antd";
import { backup } from "../../model.mjs";
import { saveFile } from "../io.js";
export function RecordsModal({ w }) {
  const file = useRef(null);
  return (
    <Modal
      title="记录与备份"
      open={w.dialog === "records"}
      onCancel={() => w.setDialog("")}
      footer={null}
      width={720}
      destroyOnHidden
      closable={{ "aria-label": "关闭窗口" }}
      className="studio-modal"
    >
      {w.message && (
        <Alert className="feedback" type="info" title={w.message} />
      )}{" "}
      {w.storageError && (
        <Alert className="feedback" type="warning" title={w.storageError} />
      )}
      <Space wrap>
        <Button onClick={w.reset}>新建输入</Button>
        <Button
          onClick={() =>
            saveFile(
              "画面工作台-v6备份.json",
              JSON.stringify(backup(w.data), null, 2),
              "application/json",
            )
          }
        >
          导出当前备份
        </Button>
        <Button onClick={() => file.current?.click()}>恢复v6备份</Button>
        <input
          ref={file}
          className="file-input"
          type="file"
          accept=".json,application/json"
          aria-label="恢复v6备份"
          onChange={w.restoreFile}
        />
        {w.raw !== null && w.storageError && (
          <Button onClick={() => saveFile("原始损坏记录.txt", w.raw)}>
            导出原始记录
          </Button>
        )}
      </Space>
      <p className="hint">
        恢复将替换当前草稿和历史。V18与V19共用这份数据；更早的旧格式通过旧版本查看。
      </p>
      <h3 className="history-heading">
        生成历史 <Typography.Text type="secondary">最近30次</Typography.Text>
      </h3>
      {w.data.history.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="还没有生成记录。"
        />
      ) : (
        <div className="history">
          {w.data.history.map((r) => (
            <Card size="small" key={r.id}>
              <div className="history-row">
                <div>
                  <strong>{r.schemes[0].title}</strong>
                  <small>
                    {new Date(r.createdAt).toLocaleString()} ·{" "}
                    {r.schemes.length}对
                  </small>
                </div>
                <Space>
                  <Button size="small" onClick={() => w.viewHistory(r)}>
                    查看
                  </Button>
                  <Button size="small" onClick={() => w.reuseHistory(r)}>
                    复用输入
                  </Button>
                </Space>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Modal>
  );
}
