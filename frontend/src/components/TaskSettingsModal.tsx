import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Input, Modal, Select, Space, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { AppointmentTaskConfig, AppointmentTaskConfigPayload } from '../types/appointment';

interface TaskSettingsModalProps {
  open: boolean;
  configs: AppointmentTaskConfig[];
  confirmLoading?: boolean;
  onCancel: () => void;
  onSave: (configs: AppointmentTaskConfigPayload[]) => Promise<void>;
}

const roundLabels = ['第一轮', '第二轮', '第三轮', '第四轮', '第五轮', '第六轮', '第七轮', '第八轮', '第九轮', '第十轮'];
const defaultSessions = ['Session 1', 'Session 2', 'Session 3', 'Session 4', 'Session 5'];

function createDefaultRoundSessions(sessions = defaultSessions) {
  return Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => [String(index + 1), [...sessions]])
  );
}

function createDefaultTaskConfig(): AppointmentTaskConfigPayload {
  return {
    name: '新任务',
    sessions: [...defaultSessions],
    rounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    roundSessions: createDefaultRoundSessions()
  };
}

function normalizeConfig(config: AppointmentTaskConfig): AppointmentTaskConfigPayload {
  const roundSessions = createDefaultRoundSessions(config.sessions);

  for (const [round, sessions] of Object.entries(config.roundSessions ?? {})) {
    if (Array.isArray(sessions)) {
      roundSessions[round] = sessions;
    }
  }

  return {
    name: config.name,
    sessions: [...config.sessions],
    rounds: config.rounds.length ? [...config.rounds] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    roundSessions
  };
}

export function TaskSettingsModal({
  open,
  configs,
  confirmLoading,
  onCancel,
  onSave
}: TaskSettingsModalProps) {
  const [draftConfigs, setDraftConfigs] = useState<AppointmentTaskConfigPayload[]>([]);
  const [selectedRound, setSelectedRound] = useState(1);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftConfigs(configs.map(normalizeConfig));
    setSelectedRound(1);
  }, [configs, open]);

  const activeConfigs = useMemo(
    () => draftConfigs
      .map((config, index) => ({ config, index }))
      .filter(({ config }) => config.rounds.includes(selectedRound)),
    [draftConfigs, selectedRound]
  );

  function updateDraftTask(index: number, patch: Partial<AppointmentTaskConfigPayload>) {
    setDraftConfigs((current) =>
      current.map((config, itemIndex) => itemIndex === index ? { ...config, ...patch } : config)
    );
  }

  function addDraftTask() {
    setDraftConfigs((current) => [...current, createDefaultTaskConfig()]);
  }

  function removeDraftTaskFromRound(index: number) {
    setDraftConfigs((current) =>
      current.map((config, itemIndex) => {
        if (itemIndex !== index) {
          return config;
        }

        return {
          ...config,
          rounds: config.rounds.filter((round) => round !== selectedRound),
          roundSessions: {
            ...config.roundSessions,
            [String(selectedRound)]: []
          }
        };
      })
    );
  }

  function updateDraftSession(taskIndex: number, sessionIndex: number, value: string) {
    setDraftConfigs((current) =>
      current.map((config, itemIndex) => {
        if (itemIndex !== taskIndex) {
          return config;
        }

        const roundKey = String(selectedRound);
        const sessions = [...(config.roundSessions[roundKey] ?? [])];
        sessions[sessionIndex] = value;
        return {
          ...config,
          roundSessions: {
            ...config.roundSessions,
            [roundKey]: sessions
          }
        };
      })
    );
  }

  function addDraftSession(taskIndex: number) {
    setDraftConfigs((current) =>
      current.map((config, itemIndex) => {
        if (itemIndex !== taskIndex) {
          return config;
        }

        const roundKey = String(selectedRound);
        const sessions = config.roundSessions[roundKey] ?? [];
        return {
          ...config,
          roundSessions: {
            ...config.roundSessions,
            [roundKey]: [...sessions, `Session ${sessions.length + 1}`]
          }
        };
      })
    );
  }

  function removeDraftSession(taskIndex: number, sessionIndex: number) {
    setDraftConfigs((current) =>
      current.map((config, itemIndex) => {
        if (itemIndex !== taskIndex) {
          return config;
        }

        const roundKey = String(selectedRound);
        const sessions = config.roundSessions[roundKey] ?? [];
        return {
          ...config,
          roundSessions: {
            ...config.roundSessions,
            [roundKey]: sessions.filter((_, index) => index !== sessionIndex)
          }
        };
      })
    );
  }

  async function handleSave() {
    await onSave(
      draftConfigs.map((config) => {
        const roundSessions = Object.fromEntries(
          Object.entries(config.roundSessions).map(([round, sessions]) => [
            round,
            sessions.map((session) => session.trim()).filter(Boolean)
          ])
        );
        const rounds = Array.from(
          new Set(
            Object.entries(roundSessions)
              .filter(([, sessions]) => sessions.length > 0)
              .map(([round]) => Number(round))
              .filter((round) => Number.isInteger(round) && round >= 1 && round <= 10)
          )
        ).sort((a, b) => a - b);

        return {
          name: config.name.trim(),
          sessions: rounds.length ? roundSessions[String(rounds[0])] ?? [] : [],
          rounds,
          roundSessions
        };
      })
    );
  }

  return (
    <Modal
      title="任务设置"
      open={open}
      width={980}
      confirmLoading={confirmLoading}
      onCancel={onCancel}
      onOk={handleSave}
      okText="保存"
      cancelText="取消"
    >
      <Space direction="vertical" size={14} className="appointment-list">
        <Space className="task-settings-toolbar">
          <Typography.Text strong>轮数</Typography.Text>
          <Select
            value={selectedRound}
            options={roundLabels.map((label, index) => ({ value: index + 1, label }))}
            onChange={setSelectedRound}
            className="task-settings-round-select"
          />
        </Space>
        <Typography.Paragraph type="secondary">
          每一轮默认拥有全部任务。删除任务或修改 Session 只影响当前选择的轮数；预约新建时会按所选轮数显示对应 Session。
        </Typography.Paragraph>
        {activeConfigs.map(({ config, index: taskIndex }) => {
          const sessions = config.roundSessions[String(selectedRound)] ?? [];

          return (
            <Card
              key={`${selectedRound}-${taskIndex}`}
              size="small"
              title={
                <Input
                  value={config.name}
                  placeholder="任务名称"
                  onChange={(event) => updateDraftTask(taskIndex, { name: event.target.value })}
                />
              }
              extra={
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => removeDraftTaskFromRound(taskIndex)}
                />
              }
            >
              <Typography.Text strong>Session</Typography.Text>
              <Space direction="vertical" size={8} className="appointment-list task-session-editor">
                {sessions.map((session, sessionIndex) => (
                  <Space key={sessionIndex}>
                    <Input
                      value={session}
                      placeholder="Session 名称"
                      onChange={(event) => updateDraftSession(taskIndex, sessionIndex, event.target.value)}
                    />
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => removeDraftSession(taskIndex, sessionIndex)}
                    />
                  </Space>
                ))}
                <Button size="small" icon={<PlusOutlined />} onClick={() => addDraftSession(taskIndex)}>
                  新增 Session
                </Button>
              </Space>
            </Card>
          );
        })}
        <Button icon={<PlusOutlined />} onClick={addDraftTask}>
          新增任务模板
        </Button>
      </Space>
    </Modal>
  );
}
