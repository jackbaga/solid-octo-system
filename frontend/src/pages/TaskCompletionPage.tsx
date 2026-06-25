import { ArrowLeftOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, LogoutOutlined, SettingOutlined, UploadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { Button, Form, Input, Layout, message, Modal, Popconfirm, Select, Space, Table, Tag, Typography, Upload } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import type { Key } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  clearTaskCompletionRecords,
  deleteTaskCompletionRecord,
  exportTaskCompletionRecords,
  fetchTaskCompletionRecords,
  importTaskCompletion,
  promoteTaskCompletionRecord,
  updateTaskCompletionRecord
} from '../services/taskCompletionApi';
import {
  fetchAppointmentTaskConfigs,
  saveAppointmentTaskConfigs
} from '../services/appointmentApi';
import { teacherLabels, teacherOptions } from '../constants/volunteer';
import { TaskSettingsModal } from '../components/TaskSettingsModal';
import { AppointmentTaskConfig, AppointmentTaskConfigPayload } from '../types/appointment';
import { CompletionTaskMap, TaskCompletionRecord } from '../types/taskCompletion';
import { Teacher } from '../types/volunteer';

const { Header, Content } = Layout;
const roundLabels = ['第一轮', '第二轮', '第三轮', '第四轮', '第五轮', '第六轮', '第七轮', '第八轮', '第九轮', '第十轮'];
const completionFilters = [
  { text: '已完成', value: 'completed' },
  { text: '未完成', value: 'incomplete' }
];

function normalizeTaskDisplayName(taskName: string) {
  if (taskName.startsWith('基线轮')) {
    return taskName.replace('基线轮', '第一轮');
  }

  const digitMatch = taskName.match(/(?:第)?([1-9]|10)轮/);
  if (digitMatch) {
    const label = roundLabels[Number(digitMatch[1]) - 1];
    return taskName.replace(digitMatch[0], label);
  }

  return taskName;
}

function stripRoundPrefix(taskName: string) {
  return normalizeTaskDisplayName(taskName).replace(/^第[一二三四五六七八九十]轮-/, '');
}

function getTaskRoundName(taskName: string) {
  return normalizeTaskDisplayName(taskName).split('-')[0] || '未分轮次';
}

function isParentTask(taskName: string) {
  return normalizeTaskDisplayName(taskName).includes('家长');
}

function getFirstNumber(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

function sortSessions(sessions: string[]) {
  return sessions
    .map((sessionName, index) => ({ sessionName, index }))
    .sort((a, b) => {
      const numberDiff = getFirstNumber(a.sessionName) - getFirstNumber(b.sessionName);
      return numberDiff || a.index - b.index;
    })
    .map((item) => item.sessionName);
}

function isDistributed(value: string | null | undefined) {
  return ['1', '是', '完成', '已完成', '已发放', 'true', 'yes'].includes(String(value ?? '').trim().toLowerCase());
}

function normalizeDistributionDisplay(value: string | null | undefined) {
  return isDistributed(value) ? '已发放' : '未发放';
}

function getNextRoundName(currentRound: string) {
  const index = roundLabels.indexOf(currentRound);
  return index >= 0 && index < roundLabels.length - 1 ? roundLabels[index + 1] : null;
}

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errors?: string[] } | undefined;

    if (data?.errors?.length) {
      return data.errors.join('\n');
    }

    if (data?.message) {
      return data.message;
    }
  }

  return '操作失败，请稍后重试';
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function TaskCompletionPage() {
  const [records, setRecords] = useState<TaskCompletionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [roundFilter, setRoundFilter] = useState('ALL');
  const [importRound, setImportRound] = useState('第一轮');
  const [nameSearch, setNameSearch] = useState('');
  const [taskConfigs, setTaskConfigs] = useState<AppointmentTaskConfig[]>([]);
  const [taskSettingsOpen, setTaskSettingsOpen] = useState(false);
  const [taskSettingsLoading, setTaskSettingsLoading] = useState(false);
  const [personalInfoOpen, setPersonalInfoOpen] = useState(false);
  const [personalInfoLoading, setPersonalInfoLoading] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TaskCompletionRecord | null>(null);
  const [personalInfoForm] = Form.useForm<{
    parentAccount?: string;
    parentPassword?: string;
    parentPhone?: string;
    personalAccount?: string;
    personalPassword?: string;
    assignedTeacher?: Teacher | null;
  }>();
  const [messageApi, contextHolder] = message.useMessage();

  function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    window.dispatchEvent(new Event('auth:logout'));
  }

  function normalizeTasks(tasks: CompletionTaskMap) {
    return Object.fromEntries(
      Object.entries(tasks).map(([taskName, task]) => {
        const sessions = task.sessions ?? {};
        const sessionValues = Object.values(sessions);
        return [
          taskName,
          {
            sessions,
            completed: sessionValues.length > 0 && sessionValues.every(Boolean)
          }
        ];
      })
    ) as CompletionTaskMap;
  }

  function updateRecordLocally(nextRecord: TaskCompletionRecord) {
    setRecords((current) =>
      current.map((record) => record.id === nextRecord.id ? nextRecord : record)
    );
  }

  async function saveRecordPatch(
    id: number,
    payload: {
      parentAccount?: string | null;
      parentPassword?: string | null;
      parentPhone?: string | null;
      personalAccount?: string | null;
      personalPassword?: string | null;
      assignedTeacher?: Teacher | null;
      paymentStatus?: string | null;
      cognitiveReportStatus?: string | null;
      remark?: string | null;
      tasks?: CompletionTaskMap;
    }
  ) {
    try {
      const nextRecord = await updateTaskCompletionRecord(id, payload);
      updateRecordLocally(nextRecord);
    } catch (error) {
      messageApi.error(getErrorMessage(error));
      await loadRecords();
    }
  }

  function toggleTask(record: TaskCompletionRecord, taskName: string) {
    const currentTask = record.tasks?.[taskName] ?? { sessions: {}, completed: false };
    const nextCompleted = !currentTask.completed;
    const nextTasks = {
      ...record.tasks,
      [taskName]: {
        sessions: Object.fromEntries(
          Object.keys(currentTask.sessions ?? {}).map((sessionName) => [sessionName, nextCompleted])
        ),
        completed: nextCompleted
      }
    };

    updateRecordLocally({ ...record, tasks: nextTasks });
    saveRecordPatch(record.id, { tasks: nextTasks });
  }

  function toggleSession(record: TaskCompletionRecord, taskName: string, sessionName: string) {
    const currentTask = record.tasks?.[taskName] ?? { sessions: {}, completed: false };
    const nextTasks = normalizeTasks({
      ...record.tasks,
      [taskName]: {
        ...currentTask,
        sessions: {
          ...currentTask.sessions,
          [sessionName]: !currentTask.sessions?.[sessionName]
        }
      }
    });

    updateRecordLocally({ ...record, tasks: nextTasks });
    saveRecordPatch(record.id, { tasks: nextTasks });
  }

  function saveRemark(record: TaskCompletionRecord, remark: string) {
    const nextRemark = remark.trim() || null;
    updateRecordLocally({ ...record, remark: nextRemark });
    saveRecordPatch(record.id, { remark: nextRemark });
  }

  function toggleDistributionStatus(record: TaskCompletionRecord, field: 'paymentStatus' | 'cognitiveReportStatus') {
    const nextValue = isDistributed(record[field]) ? '未发放' : '已发放';
    const nextRecord = { ...record, [field]: nextValue };
    updateRecordLocally(nextRecord);
    saveRecordPatch(record.id, { [field]: nextValue });
  }

  function openPersonalInfoModal(record: TaskCompletionRecord) {
    setEditingRecord(record);
    personalInfoForm.setFieldsValue({
      parentAccount: record.parentAccount ?? '',
      parentPassword: record.parentPassword ?? '',
      parentPhone: record.parentPhone ?? '',
      personalAccount: record.personalAccount ?? '',
      personalPassword: record.personalPassword ?? '',
      assignedTeacher: record.assignedTeacher ?? null
    });
    setPersonalInfoOpen(true);
  }

  async function handleSavePersonalInfo() {
    if (!editingRecord) {
      return;
    }

    const values = await personalInfoForm.validateFields();
    setPersonalInfoLoading(true);
    try {
      const nextRecord = await updateTaskCompletionRecord(editingRecord.id, {
        parentAccount: values.parentAccount?.trim() || null,
        parentPassword: values.parentPassword?.trim() || null,
        parentPhone: values.parentPhone?.trim() || null,
        personalAccount: values.personalAccount?.trim() || null,
        personalPassword: values.personalPassword?.trim() || null,
        assignedTeacher: values.assignedTeacher ?? null
      });
      updateRecordLocally(nextRecord);
      setPersonalInfoOpen(false);
      setEditingRecord(null);
      messageApi.success('被试者个人信息已保存');
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setPersonalInfoLoading(false);
    }
  }

  function canPromoteRecord(record: TaskCompletionRecord) {
    if (roundFilter === 'ALL' || !getNextRoundName(roundFilter)) {
      return false;
    }

    const roundTasks = Object.entries(record.tasks ?? {}).filter(([taskName]) => getTaskRoundName(taskName) === roundFilter);

    return roundTasks.length > 0 &&
      roundTasks.every(([, task]) => task.completed) &&
      isDistributed(record.paymentStatus) &&
      isDistributed(record.cognitiveReportStatus);
  }

  async function handlePromoteRecord(record: TaskCompletionRecord) {
    if (roundFilter === 'ALL') {
      return;
    }

    try {
      const nextRecord = await promoteTaskCompletionRecord(record.id, roundFilter);
      updateRecordLocally(nextRecord);
      messageApi.success(`${record.subjectName} 已进入${getNextRoundName(roundFilter)}`);
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    }
  }

  async function loadRecords() {
    setLoading(true);
    try {
      const data = await fetchTaskCompletionRecords();
      setRecords(data);
      setCurrentPage(1);
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function loadTaskConfigs() {
    const configs = await fetchAppointmentTaskConfigs();
    setTaskConfigs(configs);
    return configs;
  }

  useEffect(() => {
    loadRecords();
    loadTaskConfigs().catch((error) => messageApi.error(getErrorMessage(error)));
  }, []);

  async function openTaskSettings() {
    try {
      const configs = await loadTaskConfigs();
      setTaskConfigs(configs);
      setTaskSettingsOpen(true);
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    }
  }

  async function handleSaveTaskSettings(configs: AppointmentTaskConfigPayload[]) {
    setTaskSettingsLoading(true);
    try {
      const savedConfigs = await saveAppointmentTaskConfigs(configs);
      setTaskConfigs(savedConfigs);
      setTaskSettingsOpen(false);
      messageApi.success('任务设置已保存');
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setTaskSettingsLoading(false);
    }
  }

  const taskColumns = useMemo(() => {
    const configuredTasks = taskConfigs.flatMap((config, configIndex) => {
      const taskBaseName = stripRoundPrefix(config.name);
      return config.rounds.flatMap((round) => {
        const roundName = roundLabels[round - 1];
        const sessions = config.roundSessions?.[String(round)] ?? config.sessions;

        if (!roundName || sessions.length === 0) {
          return [];
        }

        return [{
          taskName: `${roundName}-${taskBaseName}`,
          sessions: new Set(sessions),
          index: configIndex * 10 + round
        }];
      });
    });

    return configuredTasks
      .filter(({ taskName }) => roundFilter === 'ALL' || getTaskRoundName(taskName) === roundFilter)
      .sort((a, b) => {
        if (isParentTask(a.taskName) !== isParentTask(b.taskName)) {
          return isParentTask(a.taskName) ? 1 : -1;
        }

        return a.index - b.index;
      })
      .map(({ taskName, sessions }) => ({
        title: normalizeTaskDisplayName(taskName),
        key: taskName,
        children: [
          {
            title: '任务',
            key: `${taskName}-completed`,
            width: 90,
            filters: completionFilters,
            filterMultiple: false,
            onFilter: (value: boolean | Key, record: TaskCompletionRecord) => {
              const completed = Boolean(record.tasks?.[taskName]?.completed);
              return value === 'completed' ? completed : !completed;
            },
            render: (_: unknown, record: TaskCompletionRecord) => (
              <Tag
                color={record.tasks?.[taskName]?.completed ? 'success' : 'default'}
                className="editable-completion-tag"
                onClick={() => toggleTask(record, taskName)}
              >
                {record.tasks?.[taskName]?.completed ? '完成' : '未完成'}
              </Tag>
            )
          },
          ...sortSessions(Array.from(sessions)).map((sessionName) => ({
            title: sessionName,
            key: `${taskName}-${sessionName}`,
            width: 110,
            filters: completionFilters,
            filterMultiple: false,
            onFilter: (value: boolean | Key, record: TaskCompletionRecord) => {
              const completed = Boolean(record.tasks?.[taskName]?.sessions?.[sessionName]);
              return value === 'completed' ? completed : !completed;
            },
            render: (_: unknown, record: TaskCompletionRecord) => (
              <Tag
                color={record.tasks?.[taskName]?.sessions?.[sessionName] ? 'success' : 'default'}
                className="editable-completion-tag"
                onClick={() => toggleSession(record, taskName, sessionName)}
              >
                {record.tasks?.[taskName]?.sessions?.[sessionName] ? '完成' : '未完成'}
              </Tag>
            )
          }))
        ]
      }));
  }, [roundFilter, taskConfigs]);

  const filteredRecords = useMemo(() => {
    const keyword = nameSearch.trim().toLowerCase();
    const visibleTaskNames = new Set(
      taskConfigs.flatMap((config) => {
        const taskBaseName = stripRoundPrefix(config.name);
        return config.rounds.map((round) => `${roundLabels[round - 1]}-${taskBaseName}`);
      })
    );

    return records.filter((record) => {
      const matchesRound = roundFilter === 'ALL' ||
        Object.keys(record.tasks ?? {}).some((taskName) => (
          getTaskRoundName(taskName) === roundFilter && visibleTaskNames.has(normalizeTaskDisplayName(taskName))
        ));
      const matchesName = !keyword || record.subjectName.toLowerCase().includes(keyword);

      return matchesRound && matchesName;
    });
  }, [nameSearch, records, roundFilter, taskConfigs]);

  const roundOptions = useMemo(() => {
    return [
      { value: 'ALL', label: '全部轮次' },
      ...roundLabels.map((round) => ({ value: round, label: round }))
    ];
  }, []);

  const columns: ColumnsType<TaskCompletionRecord> = [
    {
      title: '姓名',
      dataIndex: 'subjectName',
      key: 'subjectName',
      fixed: 'left',
      width: 120
    },
    {
      title: '编号',
      dataIndex: 'subjectCode',
      key: 'subjectCode',
      width: 120,
      render: (value: string) => value || '-'
    },
    {
      title: '分配老师',
      dataIndex: 'assignedTeacher',
      key: 'assignedTeacher',
      width: 120,
      render: (value: Teacher | null) => value ? teacherLabels[value] : '-'
    },
    ...taskColumns,
    {
      title: '被试费发放情况',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      width: 150,
      filters: [
        { text: '已发放', value: 'distributed' },
        { text: '未发放', value: 'undistributed' }
      ],
      filterMultiple: false,
      onFilter: (value: boolean | Key, record) => {
        const distributed = isDistributed(record.paymentStatus);
        return value === 'distributed' ? distributed : !distributed;
      },
      render: (value: string | null, record) => (
        <Tag
          color={isDistributed(value) ? 'success' : 'default'}
          className="editable-completion-tag"
          onClick={() => toggleDistributionStatus(record, 'paymentStatus')}
        >
          {normalizeDistributionDisplay(value)}
        </Tag>
      )
    },
    {
      title: '认知报告发放',
      dataIndex: 'cognitiveReportStatus',
      key: 'cognitiveReportStatus',
      width: 150,
      filters: [
        { text: '已发放', value: 'distributed' },
        { text: '未发放', value: 'undistributed' }
      ],
      filterMultiple: false,
      onFilter: (value: boolean | Key, record) => {
        const distributed = isDistributed(record.cognitiveReportStatus);
        return value === 'distributed' ? distributed : !distributed;
      },
      render: (value: string | null, record) => (
        <Tag
          color={isDistributed(value) ? 'success' : 'default'}
          className="editable-completion-tag"
          onClick={() => toggleDistributionStatus(record, 'cognitiveReportStatus')}
        >
          {normalizeDistributionDisplay(value)}
        </Tag>
      )
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 180,
      render: (value: string | null, record) => (
        <Input
          defaultValue={value ?? ''}
          placeholder="备注"
          size="small"
          onBlur={(event) => saveRemark(record, event.target.value)}
          onPressEnter={(event) => {
            event.currentTarget.blur();
          }}
        />
      )
    }
  ];

  const handleImport: UploadProps['customRequest'] = async ({ file, onError, onSuccess }) => {
    try {
      if (!(file instanceof File)) {
        throw new Error('请选择 .xlsx 文件');
      }

      const result = await importTaskCompletion(file, importRound);
      messageApi.success(`导入完成：新增 ${result.created} 条，更新 ${result.updated} 条`);
      await loadRecords();
      onSuccess?.(result);
    } catch (error) {
      messageApi.error(getErrorMessage(error));
      onError?.(error as Error);
    }
  };

  async function handleDeleteRecord(id: number) {
    try {
      await deleteTaskCompletionRecord(id);
      messageApi.success('已删除该记录');
      await loadRecords();
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    }
  }

  async function handleClearRecords() {
    try {
      const result = await clearTaskCompletionRecords();
      messageApi.success(`已清除 ${result.count} 条记录`);
      await loadRecords();
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    }
  }

  async function handleExportRecords() {
    try {
      const blob = await exportTaskCompletionRecords();
      downloadBlob(blob, '任务完成度.xlsx');
      messageApi.success('任务完成度表格已导出');
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    }
  }

  const columnsWithActions: ColumnsType<TaskCompletionRecord> = [
    ...columns,
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openPersonalInfoModal(record)}>
            编辑
          </Button>
          {canPromoteRecord(record) ? (
            <Popconfirm
              title={`确认让 ${record.subjectName} 进入${getNextRoundName(roundFilter)}？`}
              okText="进入"
              cancelText="取消"
              onConfirm={() => handlePromoteRecord(record)}
            >
              <Button size="small" type="primary">
                进入下一轮
              </Button>
            </Popconfirm>
          ) : null}
          <Popconfirm
            title="确认删除该记录？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => handleDeleteRecord(record.id)}
          >
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Layout className="app-shell">
      {contextHolder}
      <Header className="app-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} href="#/" />
          <Typography.Title level={3} className="app-title">
            任务完成度
          </Typography.Title>
        </Space>
        <Space wrap>
          <Button icon={<SettingOutlined />} onClick={openTaskSettings}>
            设置
          </Button>
          <Select
            value={importRound}
            options={roundLabels.map((round) => ({ value: round, label: `导入到${round}` }))}
            onChange={setImportRound}
            style={{ width: 150 }}
          />
          <Upload
            accept=".xlsx"
            customRequest={handleImport}
            maxCount={1}
            showUploadList={false}
          >
            <Button type="primary" icon={<UploadOutlined />}>
              上传完成度表格
            </Button>
          </Upload>
          <Button icon={<DownloadOutlined />} onClick={handleExportRecords}>
            导出 Excel
          </Button>
          <Popconfirm
            title="确认清除全部任务完成度记录？"
            okText="清除"
            cancelText="取消"
            onConfirm={handleClearRecords}
          >
            <Button danger icon={<DeleteOutlined />}>
              一键清除
            </Button>
          </Popconfirm>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            退出登录
          </Button>
        </Space>
      </Header>
      <Content className="app-content">
        <div className="toolbar">
          <Space wrap>
            <Typography.Text strong>轮次筛选</Typography.Text>
            <Select
              value={roundFilter}
              options={roundOptions}
              onChange={setRoundFilter}
              style={{ width: 180 }}
            />
            <Input.Search
              value={nameSearch}
              placeholder="搜索姓名"
              allowClear
              onChange={(event) => {
                setNameSearch(event.target.value);
                setCurrentPage(1);
              }}
              style={{ width: 220 }}
            />
          </Space>
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columnsWithActions}
          dataSource={filteredRecords}
          bordered
          pagination={{
            current: currentPage,
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, nextPageSize) => {
              setCurrentPage(page);
              setPageSize(nextPageSize);
            },
            onShowSizeChange: (_, nextPageSize) => {
              setCurrentPage(1);
              setPageSize(nextPageSize);
            }
          }}
          scroll={{ x: 900 + taskColumns.length * 240 }}
        />
      </Content>

      <TaskSettingsModal
        open={taskSettingsOpen}
        configs={taskConfigs}
        confirmLoading={taskSettingsLoading}
        onCancel={() => setTaskSettingsOpen(false)}
        onSave={handleSaveTaskSettings}
      />

      <Modal
        title={editingRecord ? `${editingRecord.subjectName} 的个人信息` : '被试者个人信息'}
        open={personalInfoOpen}
        confirmLoading={personalInfoLoading}
        onCancel={() => {
          setPersonalInfoOpen(false);
          setEditingRecord(null);
        }}
        onOk={handleSavePersonalInfo}
        okText="保存"
        cancelText="取消"
      >
        <Form form={personalInfoForm} layout="vertical">
          <Form.Item label="家长账号" name="parentAccount">
            <Input placeholder="请输入家长账号" />
          </Form.Item>
          <Form.Item label="家长密码" name="parentPassword">
            <Input placeholder="请输入家长密码" />
          </Form.Item>
          <Form.Item label="家长电话" name="parentPhone">
            <Input placeholder="请输入家长电话" />
          </Form.Item>
          <Form.Item label="个人账号" name="personalAccount">
            <Input placeholder="请输入个人账号" />
          </Form.Item>
          <Form.Item label="个人密码" name="personalPassword">
            <Input placeholder="请输入个人密码" />
          </Form.Item>
          <Form.Item label="分配老师" name="assignedTeacher">
            <Select allowClear placeholder="请选择分配老师" options={teacherOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
