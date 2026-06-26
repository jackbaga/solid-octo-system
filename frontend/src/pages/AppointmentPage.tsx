import {
  ArrowLeftOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  LeftOutlined,
  LogoutOutlined,
  PlusOutlined,
  RightOutlined,
  SettingOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import {
  Button,
  Card,
  Checkbox,
  Layout,
  message,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { AppointmentFormModal } from '../components/AppointmentFormModal';
import { TaskSettingsModal } from '../components/TaskSettingsModal';
import {
  appointmentProjectTypeLabels,
  appointmentStatusColors,
  appointmentStatusLabels,
  defaultAppointmentTimes
} from '../constants/appointment';
import {
  createAppointment,
  deleteAppointment,
  exportAppointments,
  fetchAppointmentDay,
  fetchAppointmentTaskConfigs,
  fetchAppointments,
  saveAppointmentTaskConfigs,
  syncAppointmentDaySummary,
  updateAppointmentDay,
  updateAppointment
} from '../services/appointmentApi';
import { fetchTaskCompletionRecords, syncTaskCompletionFromAppointments } from '../services/taskCompletionApi';
import { fetchVolunteers } from '../services/volunteerApi';
import { Appointment, AppointmentPayload, AppointmentTaskConfig, AppointmentTaskConfigPayload } from '../types/appointment';
import { TaskCompletionRecord } from '../types/taskCompletion';
import { Volunteer } from '../types/volunteer';
import { teacherLabels } from '../constants/volunteer';

const { Header, Content } = Layout;
type CalendarView = 'week' | 'month' | 'year';
const chineseWeekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const chineseRoundNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const hourOptions = Array.from({ length: 24 }, (_, index) => index);
const minuteOptions = Array.from({ length: 60 }, (_, index) => index);

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

function sortTimes(times: string[]) {
  return [...times].sort((a, b) => {
    const [aHour, aMinute] = a.split(':').map(Number);
    const [bHour, bMinute] = b.split(':').map(Number);
    return aHour * 60 + aMinute - (bHour * 60 + bMinute);
  });
}

function getWeekDays(date: Dayjs) {
  const start = date.startOf('week');
  return Array.from({ length: 7 }, (_, index) => start.add(index, 'day'));
}

function getMonthCells(date: Dayjs) {
  const start = date.startOf('month').startOf('week');
  return Array.from({ length: 42 }, (_, index) => start.add(index, 'day'));
}

function getMiniMonthCells(date: Dayjs) {
  const start = date.startOf('month').startOf('week');
  return Array.from({ length: 42 }, (_, index) => start.add(index, 'day'));
}

function getAppointmentSubjectName(appointment: Appointment) {
  return appointment.subjectName || appointment.volunteer?.name || '';
}

function normalizeSubjectName(name: string) {
  return name.trim().replace(/\s+/g, '');
}

function splitSessionValue(value?: string | null) {
  return String(value ?? '')
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getRoundNumber(round?: string | null) {
  if (!round) {
    return null;
  }

  const digitMatch = round.match(/\d+/);
  if (digitMatch) {
    return Number(digitMatch[0]);
  }

  const chineseIndex = chineseRoundNumbers.findIndex((value) => round.includes(value));
  return chineseIndex >= 0 ? chineseIndex + 1 : null;
}

function formatAppointmentSummary(appointment: Appointment, taskCompletionRecords: TaskCompletionRecord[]) {
  const subjectName = getAppointmentSubjectName(appointment);
  const normalizedSubjectName = normalizeSubjectName(subjectName);
  const taskCompletionTeacher = taskCompletionRecords.find(
    (record) => normalizeSubjectName(record.subjectName) === normalizedSubjectName
  )?.assignedTeacher;
  const teacher = taskCompletionTeacher ?? appointment.volunteer?.teacher ?? null;
  const teacherName = teacher ? teacherLabels[teacher] : '未分配老师';
  const remark = appointment.remark ? `，${appointment.remark}` : '';
  const session = appointment.session ? `，${appointment.session}` : '';
  const round = appointment.round ? `，${appointment.round}` : '';
  const displaySubjectName = subjectName || '未选择被试';
  const projectName = appointment.projectName || appointmentProjectTypeLabels[appointment.projectType];

  return `${projectName}：${displaySubjectName}（${teacherName}${session}${round}${remark}）`;
}

export function AppointmentPage() {
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [customTimes, setCustomTimes] = useState<string[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [taskConfigs, setTaskConfigs] = useState<AppointmentTaskConfig[]>([]);
  const [taskCompletionRecords, setTaskCompletionRecords] = useState<TaskCompletionRecord[]>([]);
  const [taskSettingsOpen, setTaskSettingsOpen] = useState(false);
  const [taskSettingsLoading, setTaskSettingsLoading] = useState(false);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [assistants, setAssistants] = useState<string[]>([]);
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; time: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [subjectInfoOpen, setSubjectInfoOpen] = useState(false);
  const [subjectInfoLoading, setSubjectInfoLoading] = useState(false);
  const [subjectInfoRecords, setSubjectInfoRecords] = useState<TaskCompletionRecord[]>([]);
  const [completionExportOpen, setCompletionExportOpen] = useState(false);
  const [completionExportLoading, setCompletionExportLoading] = useState(false);
  const [completionSelectedSessions, setCompletionSelectedSessions] = useState<Record<number, string[]>>({});
  const [incompleteIds, setIncompleteIds] = useState<number[]>([]);
  const [activeTime, setActiveTime] = useState('');
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(30);
  const [messageApi, contextHolder] = message.useMessage();

  function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    window.dispatchEvent(new Event('auth:logout'));
  }

  const selectedDateText = selectedDate.format('YYYY-MM-DD');
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const monthCells = useMemo(() => getMonthCells(selectedDate), [selectedDate]);
  const yearMonths = useMemo(
    () => Array.from({ length: 12 }, (_, index) => selectedDate.month(index).startOf('month')),
    [selectedDate]
  );
  const times = useMemo(
    () => sortTimes(Array.from(new Set([...defaultAppointmentTimes, ...customTimes, ...appointments.map((item) => item.time)]))),
    [appointments, customTimes]
  );

  async function loadPageData(date = selectedDateText) {
    setLoading(true);
    try {
      const [appointmentData, volunteerData, completionRecords] = await Promise.all([
        fetchAppointments(date),
        fetchVolunteers('ALL'),
        fetchTaskCompletionRecords()
      ]);
      const dayData = await fetchAppointmentDay(date);
      const configData = await fetchAppointmentTaskConfigs();
      setAppointments(appointmentData);
      setVolunteers(volunteerData);
      setTaskCompletionRecords(completionRecords);
      setTaskConfigs(configData);
      setAssistants(dayData.assistants);
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPageData(selectedDateText);
  }, [selectedDateText]);

  useEffect(() => {
    function hideContextMenu() {
      setContextMenu(null);
    }

    window.addEventListener('click', hideContextMenu);
    return () => window.removeEventListener('click', hideContextMenu);
  }, []);

  function openCreateModal(time: string) {
    setActiveTime(time);
    setEditingAppointment(null);
    setModalOpen(true);
  }

  function openEditModal(appointment: Appointment) {
    setActiveTime(appointment.time);
    setEditingAppointment(appointment);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingAppointment(null);
  }

  async function handleSubmit(payload: AppointmentPayload) {
    setModalLoading(true);
    try {
      if (editingAppointment) {
        await updateAppointment(editingAppointment.id, payload);
        messageApi.success('预约已更新');
      } else {
        await createAppointment(payload);
        messageApi.success('预约已新增');
      }

      closeModal();
      await loadPageData();
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setModalLoading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteAppointment(id);
      messageApi.success('预约已删除');
      await loadPageData();
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    }
  }

  function handleAddTime() {
    const time = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;

    if (!customTimes.includes(time) && !defaultAppointmentTimes.includes(time)) {
      setCustomTimes((current) => [...current, time]);
    }

    setTimeModalOpen(false);
  }

  function handleDeleteTime(time: string) {
    setCustomTimes((current) => current.filter((item) => item !== time));
  }

  async function handleSaveAssistants(nextAssistants: string[]) {
    setAssistants(nextAssistants);
    try {
      await updateAppointmentDay(selectedDateText, nextAssistants);
      messageApi.success('当日实验助理已更新');
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    }
  }

  function findSubjectInfoRecord(appointment: Appointment) {
    const subjectName = normalizeSubjectName(getAppointmentSubjectName(appointment));
    return subjectInfoRecords.find((record) => normalizeSubjectName(record.subjectName) === subjectName)
      ?? taskCompletionRecords.find((record) => normalizeSubjectName(record.subjectName) === subjectName)
      ?? null;
  }

  function isParentAppointment(appointment: Appointment) {
    const projectName = appointment.projectName || appointmentProjectTypeLabels[appointment.projectType];
    return projectName.includes('家长') || projectName.includes('访谈');
  }

  function hasParentSubjectInfo(appointment: Appointment) {
    const record = findSubjectInfoRecord(appointment);
    return Boolean(record?.parentAccount || record?.parentPassword || record?.parentPhone);
  }

  function hasPersonalSubjectInfo(appointment: Appointment) {
    const record = findSubjectInfoRecord(appointment);
    return Boolean(record?.personalAccount || record?.personalPassword);
  }

  function shouldShowInParentInfo(appointment: Appointment) {
    return isParentAppointment(appointment) || hasParentSubjectInfo(appointment);
  }

  function shouldShowInFormalInfo(appointment: Appointment) {
    return !isParentAppointment(appointment) || hasPersonalSubjectInfo(appointment);
  }

  function getAppointmentTaskName(appointment: Appointment) {
    return appointment.projectName || appointmentProjectTypeLabels[appointment.projectType];
  }

  function getCompletionExportSessions(appointment: Appointment) {
    const taskName = getAppointmentTaskName(appointment);
    const taskConfig = taskConfigs.find((config) => config.name === taskName);
    const roundNumber = getRoundNumber(appointment.round);
    const configuredSessions = roundNumber && taskConfig?.roundSessions?.[String(roundNumber)]
      ? taskConfig.roundSessions[String(roundNumber)]
      : taskConfig?.sessions ?? [];

    return Array.from(new Set([
      ...configuredSessions,
      ...splitSessionValue(appointment.session)
    ])).filter(Boolean);
  }

  async function openSubjectInfoModal() {
    setSubjectInfoLoading(true);
    setSubjectInfoOpen(true);
    try {
      const records = await fetchTaskCompletionRecords();
      setSubjectInfoRecords(records);
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setSubjectInfoLoading(false);
    }
  }

  function openCompletionExportModal() {
    setCompletionSelectedSessions(
      Object.fromEntries(
        appointments.map((appointment) => {
          const sessions = getCompletionExportSessions(appointment);
          const selectedSessions = splitSessionValue(appointment.session)
            .filter((session) => sessions.includes(session));

          return [appointment.id, selectedSessions];
        })
      )
    );
    setCompletionExportOpen(true);
  }

  async function handleSyncCompletionExport() {
    const items = appointments.flatMap((appointment) => {
      const selectedSessions = completionSelectedSessions[appointment.id] ?? [];

      return selectedSessions.map((selectedSession) => ({
        subjectName: appointment.subjectName || appointment.volunteer?.name || '未选择被试',
        subjectCode: '',
        taskName: `${appointment.round || '第一轮'}-${getAppointmentTaskName(appointment)}`,
        session: selectedSession,
        completed: true
      }));
    });

    if (items.length === 0) {
      messageApi.warning('请至少选择一个要导出的 Session');
      return;
    }

    setCompletionExportLoading(true);
    try {
      const result = await syncTaskCompletionFromAppointments(items);
      setTaskCompletionRecords(result.records);
      setCompletionExportOpen(false);
      messageApi.success(`已同步 ${result.touched} 条任务完成状态`);
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    } finally {
      setCompletionExportLoading(false);
    }
  }

  async function handleExportAppointments() {
    try {
      const blob = await exportAppointments();
      downloadBlob(blob, '预约安排.xlsx');
      messageApi.success('预约安排已导出');
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    }
  }

  function openSummaryModal() {
    setIncompleteIds(
      appointments
        .filter((appointment) => appointment.status !== 'COMPLETED')
        .map((appointment) => appointment.id)
    );
    setSummaryOpen(true);
  }

  async function openTaskSettings() {
    try {
      const configs = await fetchAppointmentTaskConfigs();
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

  async function handleConfirmSummary() {
    try {
      const result = await syncAppointmentDaySummary(selectedDateText, incompleteIds);
      setAppointments(result.appointments);
      setSummaryOpen(false);
      messageApi.success('当日任务完成度已同步');
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    }
  }

  function handlePrevious() {
    const amount = calendarView === 'year' ? 'year' : calendarView === 'month' ? 'month' : 'week';
    setSelectedDate((current) => current.subtract(1, amount));
  }

  function handleNext() {
    const amount = calendarView === 'year' ? 'year' : calendarView === 'month' ? 'month' : 'week';
    setSelectedDate((current) => current.add(1, amount));
  }

  function handleToday() {
    setSelectedDate(dayjs());
  }

  function handleBlankContextMenu(event: React.MouseEvent<HTMLDivElement>, time: string) {
    if ((event.target as HTMLElement).closest('.appointment-item-card')) {
      return;
    }

    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, time });
  }

  function handleCreateFromContextMenu() {
    if (contextMenu) {
      openCreateModal(contextMenu.time);
      setContextMenu(null);
    }
  }

  function renderYearView() {
    return (
      <div className="year-calendar-grid">
        {yearMonths.map((month) => (
          <button
            key={month.format('YYYY-MM')}
            className="year-month-card"
            type="button"
            onClick={() => {
              setSelectedDate(month.date(1));
              setCalendarView('month');
            }}
          >
            <Typography.Text strong>{month.format('M月')}</Typography.Text>
            <div className="mini-month-grid">
              {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
                <span key={day} className="mini-month-weekday">{day}</span>
              ))}
              {getMiniMonthCells(month).map((day) => (
                <span
                  key={day.format('YYYY-MM-DD')}
                  className={day.month() === month.month() ? 'mini-month-day' : 'mini-month-day muted'}
                >
                  {day.date()}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    );
  }

  function renderMonthView() {
    return (
      <div className="month-calendar">
        {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((day) => (
          <div key={day} className="month-weekday">{day}</div>
        ))}
        {monthCells.map((day) => (
          <button
            key={day.format('YYYY-MM-DD')}
            type="button"
            className={[
              'month-day-cell',
              day.month() !== selectedDate.month() ? 'muted' : '',
              day.isSame(selectedDate, 'day') ? 'selected' : '',
              day.isSame(dayjs(), 'day') ? 'today' : ''
            ].filter(Boolean).join(' ')}
            onClick={() => {
              setSelectedDate(day);
              setCalendarView('week');
            }}
          >
            <span>{day.date()}</span>
          </button>
        ))}
      </div>
    );
  }

  function renderWeekView() {
    return (
      <>
        <div className="week-strip">
          {weekDays.map((day) => (
            <button
              key={day.format('YYYY-MM-DD')}
              type="button"
              className={day.isSame(selectedDate, 'day') ? 'week-day selected' : 'week-day'}
              onClick={() => setSelectedDate(day)}
            >
              <span>{day.format('D')}</span>
              <strong>{chineseWeekdays[day.day()]}</strong>
            </button>
          ))}
        </div>

        <div className="appointment-board">
          {times.map((time) => {
            const timeAppointments = appointments.filter((appointment) => appointment.time === time);
            const isCustomTime = customTimes.includes(time);

            return (
              <div key={time} className="appointment-row">
                <div className="appointment-time-cell">
                  <Typography.Text strong>{time}</Typography.Text>
                  <Space>
                    <Button
                      shape="circle"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => openCreateModal(time)}
                    />
                    {isCustomTime ? (
                      <Popconfirm
                        title={
                          timeAppointments.length > 0
                            ? '该时间段已有预约，确认仅移除时间段显示？'
                            : '确认删除该时间段？'
                        }
                        okText="删除"
                        cancelText="取消"
                        onConfirm={() => handleDeleteTime(time)}
                      >
                        <Button
                          danger
                          shape="circle"
                          size="small"
                          icon={<DeleteOutlined />}
                        />
                      </Popconfirm>
                    ) : null}
                  </Space>
                </div>

                <div
                  className="appointment-slot-cell"
                  onContextMenu={(event) => handleBlankContextMenu(event, time)}
                >
                  {timeAppointments.length === 0 ? (
                    <Typography.Text type="secondary">暂无预约</Typography.Text>
                  ) : null}

                  <Space direction="vertical" size={12} className="appointment-list">
                    {timeAppointments.map((appointment) => (
                      <Card key={appointment.id} size="small" className="appointment-item-card">
                        <Space direction="vertical" size={6} className="appointment-list">
                          <Space align="center" wrap>
                            <Typography.Text strong className="appointment-summary-text">
                              {formatAppointmentSummary(appointment, taskCompletionRecords)}
                            </Typography.Text>
                            <Tag color={appointmentStatusColors[appointment.status]}>
                              {appointmentStatusLabels[appointment.status]}
                            </Tag>
                          </Space>
                          <Space>
                            <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(appointment)}>
                              编辑
                            </Button>
                            <Popconfirm
                              title="确认删除该预约？"
                              okText="删除"
                              cancelText="取消"
                              onConfirm={() => handleDelete(appointment.id)}
                            >
                              <Button size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          </Space>
                        </Space>
                      </Card>
                    ))}
                  </Space>
                </div>
              </div>
            );
          })}
          <div className="appointment-row appointment-add-time-row">
            <div className="appointment-time-cell">
              <Button
                className="add-time-button"
                shape="circle"
                icon={<PlusOutlined />}
                onClick={() => setTimeModalOpen(true)}
              />
            </div>
            <div className="appointment-slot-cell" />
          </div>
        </div>
      </>
    );
  }

  return (
    <Layout className="app-shell">
      {contextHolder}
      <Header className="app-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} href="#/" />
          <Typography.Title level={3} className="app-title">
            预约管理
          </Typography.Title>
        </Space>
        <Space wrap>
          <Button icon={<SettingOutlined />} onClick={openTaskSettings}>
            设置
          </Button>
          <Button onClick={openSubjectInfoModal}>
            当日被试者信息
          </Button>
          <Button onClick={openCompletionExportModal}>
            导出
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportAppointments}>
            导出预约表
          </Button>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            退出登录
          </Button>
        </Space>
      </Header>

      <Content className="calendar-content">
        <div className="calendar-control-row">
          <Typography.Title level={1} className="calendar-current-title">
            {calendarView === 'year' ? selectedDate.format('YYYY年') : selectedDate.format('YYYY年M月')}
          </Typography.Title>
          <Segmented
            value={calendarView}
            onChange={(value) => setCalendarView(value as CalendarView)}
            options={[
              { label: '周', value: 'week' },
              { label: '月', value: 'month' },
              { label: '年', value: 'year' }
            ]}
          />
          <Space className="calendar-nav">
            <Button icon={<LeftOutlined />} onClick={handlePrevious} />
            <Button onClick={handleToday}>今天</Button>
            <Button icon={<RightOutlined />} onClick={handleNext} />
          </Space>
        </div>

        <div className="appointment-layout">
          <div className="appointment-main">
            {calendarView === 'year' ? renderYearView() : null}
            {calendarView === 'month' ? renderMonthView() : null}
            {calendarView === 'week' ? renderWeekView() : null}
          </div>

          <aside className="assistant-panel">
            <Typography.Title level={4} className="assistant-panel-title">
              实验助理
            </Typography.Title>
            <Typography.Text type="secondary">{selectedDate.format('YYYY年M月D日')}</Typography.Text>

            <div className="assistant-tag-list">
              {assistants.length > 0 ? (
                assistants.map((assistant) => (
                  <Tag key={assistant} color="blue" className="assistant-tag">
                    {assistant}
                  </Tag>
                ))
              ) : (
                <Typography.Text type="secondary">暂未添加</Typography.Text>
              )}
            </div>

            <Select
              mode="tags"
              value={assistants}
              placeholder="输入姓名后回车"
              onChange={handleSaveAssistants}
              className="assistant-panel-select"
            />
          </aside>
        </div>
        {contextMenu ? (
          <div
            className="calendar-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={handleCreateFromContextMenu}>
              新建预约
            </button>
          </div>
        ) : null}
      </Content>

      <AppointmentFormModal
        open={modalOpen}
        time={activeTime}
        date={selectedDateText}
        appointment={editingAppointment}
        taskConfigs={taskConfigs}
        volunteers={volunteers}
        taskCompletionRecords={taskCompletionRecords}
        confirmLoading={modalLoading}
        onCancel={closeModal}
        onSubmit={handleSubmit}
      />

      <TaskSettingsModal
        open={taskSettingsOpen}
        configs={taskConfigs}
        confirmLoading={taskSettingsLoading}
        onCancel={() => setTaskSettingsOpen(false)}
        onSave={handleSaveTaskSettings}
      />

      <Modal
        title={`${selectedDateText} 当日被试者信息`}
        open={subjectInfoOpen}
        width={900}
        footer={null}
        onCancel={() => setSubjectInfoOpen(false)}
      >
        <Typography.Title level={5}>正式测试</Typography.Title>
        <Table
          rowKey={(record) => `formal-${record.id}`}
          size="small"
          loading={subjectInfoLoading}
          pagination={false}
          dataSource={appointments.filter(shouldShowInFormalInfo)}
          columns={[
            {
              title: '被试者姓名',
              render: (_: unknown, record: Appointment) => getAppointmentSubjectName(record) || '-'
            },
            {
              title: '个人账号',
              render: (_: unknown, record: Appointment) => findSubjectInfoRecord(record)?.personalAccount || '-'
            },
            {
              title: '个人密码',
              render: (_: unknown, record: Appointment) => findSubjectInfoRecord(record)?.personalPassword || '-'
            }
          ]}
        />

        <Typography.Title level={5} className="subject-info-section-title">家长访谈</Typography.Title>
        <Table
          rowKey={(record) => `parent-${record.id}`}
          size="small"
          loading={subjectInfoLoading}
          pagination={false}
          dataSource={appointments.filter(shouldShowInParentInfo)}
          columns={[
            {
              title: '被试者姓名',
              render: (_: unknown, record: Appointment) => getAppointmentSubjectName(record) || '-'
            },
            {
              title: '家长账号',
              render: (_: unknown, record: Appointment) => findSubjectInfoRecord(record)?.parentAccount || '-'
            },
            {
              title: '家长密码',
              render: (_: unknown, record: Appointment) => findSubjectInfoRecord(record)?.parentPassword || '-'
            },
            {
              title: '家长电话',
              render: (_: unknown, record: Appointment) => findSubjectInfoRecord(record)?.parentPhone || '-'
            }
          ]}
        />
      </Modal>

      <Modal
        title="导出当日任务完成状态"
        open={completionExportOpen}
        width={820}
        confirmLoading={completionExportLoading}
        onCancel={() => setCompletionExportOpen(false)}
        onOk={handleSyncCompletionExport}
        okText="导出到任务完成度"
        cancelText="取消"
      >
        <Typography.Paragraph type="secondary">
          勾选要标记完成的 Session。默认选中预约时填写的 Session，也可以选择同一任务在当前轮次下的其它 Session。
        </Typography.Paragraph>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={appointments.filter((appointment) => getCompletionExportSessions(appointment).length > 0)}
          columns={[
            {
              title: '时间',
              dataIndex: 'time',
              key: 'time',
              width: 90
            },
            {
              title: '被试',
              key: 'subjectName',
              render: (_: unknown, record: Appointment) => record.subjectName || record.volunteer?.name || '未选择被试'
            },
            {
              title: '编号',
              key: 'subjectCode',
              render: (_: unknown, record: Appointment) => record.volunteer?.account || '-'
            },
            {
              title: '任务',
              key: 'taskName',
              render: (_: unknown, record: Appointment) => getAppointmentTaskName(record)
            },
            {
              title: '导出 Session',
              key: 'sessions',
              render: (_: unknown, record: Appointment) => {
                const sessions = getCompletionExportSessions(record);

                return (
                  <Checkbox.Group
                    value={completionSelectedSessions[record.id] ?? []}
                    options={sessions.map((sessionName) => ({ label: sessionName, value: sessionName }))}
                    onChange={(values) => {
                      setCompletionSelectedSessions((current) => ({
                        ...current,
                        [record.id]: values.map(String)
                      }));
                    }}
                  />
                );
              }
            }
          ]}
        />
      </Modal>

      <Modal
        title="新增时间段"
        open={timeModalOpen}
        onCancel={() => setTimeModalOpen(false)}
        onOk={handleAddTime}
        okText="保存"
        cancelText="取消"
      >
        <div className="time-wheel-picker">
          <div className="time-wheel-column">
            <Typography.Text strong>时</Typography.Text>
            <div className="time-wheel-list">
              {hourOptions.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  className={hour === selectedHour ? 'time-wheel-option selected' : 'time-wheel-option'}
                  onClick={() => setSelectedHour(hour)}
                >
                  {String(hour).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>
          <div className="time-wheel-column">
            <Typography.Text strong>分</Typography.Text>
            <div className="time-wheel-list">
              {minuteOptions.map((minute) => (
                <button
                  key={minute}
                  type="button"
                  className={minute === selectedMinute ? 'time-wheel-option selected' : 'time-wheel-option'}
                  onClick={() => setSelectedMinute(minute)}
                >
                  {String(minute).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>
        </div>
        <Typography.Text type="secondary">
          当前选择：{String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')}
        </Typography.Text>
      </Modal>

      <Modal
        title="更新当日任务完成度"
        open={summaryOpen}
        onCancel={() => setSummaryOpen(false)}
        onOk={handleConfirmSummary}
        okText="确认同步"
        cancelText="取消"
      >
        <Typography.Paragraph type="secondary">
          勾选当日没做完的预约，确认后会同步更新任务完成度。
        </Typography.Paragraph>
        <Space direction="vertical" className="appointment-list">
          {appointments.map((appointment) => (
            <label key={appointment.id} className="summary-check-row">
              <input
                type="checkbox"
                checked={incompleteIds.includes(appointment.id)}
                onChange={(event) => {
                  setIncompleteIds((current) =>
                    event.target.checked
                      ? [...current, appointment.id]
                      : current.filter((id) => id !== appointment.id)
                  );
                }}
              />
              <span>
                {appointment.time} - {appointment.subjectName} - {appointmentProjectTypeLabels[appointment.projectType]}
              </span>
            </label>
          ))}
        </Space>
      </Modal>
    </Layout>
  );
}
