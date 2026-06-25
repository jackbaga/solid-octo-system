import {
  CloseCircleFilled,
  LeftOutlined,
  MinusCircleFilled,
  RightOutlined
} from '@ant-design/icons';
import { Button, Input, Modal, Select, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import {
  Appointment,
  AppointmentPayload,
  AppointmentTaskConfig
} from '../types/appointment';
import { TaskCompletionRecord } from '../types/taskCompletion';
import { Teacher, Volunteer } from '../types/volunteer';
import { teacherLabels } from '../constants/volunteer';

type WizardStep = 'project' | 'session' | 'subject';

interface AppointmentFormModalProps {
  open: boolean;
  time: string;
  date: string;
  appointment?: Appointment | null;
  taskConfigs: AppointmentTaskConfig[];
  volunteers: Volunteer[];
  taskCompletionRecords: TaskCompletionRecord[];
  confirmLoading?: boolean;
  onCancel: () => void;
  onSubmit: (payload: AppointmentPayload) => Promise<void>;
}

const projectButtonClasses = ['project-blue', 'project-teal', 'project-green', 'project-yellow'];
const chineseRoundNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

function getTeacherName(teacher?: Teacher | null) {
  return teacher ? teacherLabels[teacher] : '未分配老师';
}

function splitSessionValue(value?: string | null) {
  return String(value ?? '')
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AppointmentFormModal({
  open,
  time,
  date,
  appointment,
  taskConfigs,
  volunteers,
  taskCompletionRecords,
  confirmLoading,
  onCancel,
  onSubmit
}: AppointmentFormModalProps) {
  const [step, setStep] = useState<WizardStep>('project');
  const [projectName, setProjectName] = useState('');
  const [sessions, setSessions] = useState<string[]>([]);
  const [round, setRound] = useState<string | null>(null);
  const [subjectKey, setSubjectKey] = useState<string | null>(null);
  const [remark, setRemark] = useState('');

  const subjectOptions = useMemo(() => {
    const taskSubjects = taskCompletionRecords
      .filter((record) => record.subjectName)
      .map((record) => ({
        key: `task-${record.id}`,
        name: record.subjectName,
        label: `${record.subjectName}（任务完成度${record.assignedTeacher ? `，${teacherLabels[record.assignedTeacher]}` : ''}）`,
        volunteerId: null as number | null,
        source: 'task' as const
      }));
    const taskSubjectNames = new Set(taskSubjects.map((subject) => subject.name));
    const volunteerSubjects = volunteers
      .filter((volunteer) => !taskSubjectNames.has(volunteer.name))
      .map((volunteer) => ({
        key: `volunteer-${volunteer.id}`,
        name: volunteer.name,
        label: `${volunteer.name}（${getTeacherName(volunteer.teacher)}）`,
        volunteerId: volunteer.id,
        source: 'volunteer' as const
      }));

    return [...taskSubjects, ...volunteerSubjects];
  }, [taskCompletionRecords, volunteers]);
  const selectedSubject = useMemo(
    () => subjectOptions.find((subject) => subject.key === subjectKey) ?? null,
    [subjectKey, subjectOptions]
  );
  const selectedTaskConfig = useMemo(
    () => taskConfigs.find((config) => config.name === projectName) ?? null,
    [projectName, taskConfigs]
  );
  const projectConfigs = useMemo(
    () => Array.from(new Map(taskConfigs.filter((config) => config.rounds.length > 0).map((config) => [config.name, config])).values()),
    [taskConfigs]
  );
  const roundSelectOptions = (selectedTaskConfig?.rounds ?? []).map((value) => {
    const label = `第${chineseRoundNumbers[value - 1] ?? value}轮`;
    return { value: label, label };
  });
  const selectedRoundNumber = roundSelectOptions.find((option) => option.value === round)
    ? (chineseRoundNumbers.findIndex((item) => `第${item}轮` === round) + 1)
    : null;
  const selectedRoundSessions = selectedRoundNumber && selectedTaskConfig?.roundSessions
    ? selectedTaskConfig.roundSessions[String(selectedRoundNumber)] ?? []
    : selectedTaskConfig?.sessions ?? [];
  const sessionSelectOptions = selectedRoundSessions.map((value) => ({ value, label: value }));

  useEffect(() => {
    if (!open) {
      return;
    }

    if (appointment) {
      setStep('subject');
      setProjectName(appointment.projectName || '');
      setSessions(splitSessionValue(appointment.session));
      setRound(appointment.round ?? null);
      const subject = appointment.volunteerId
        ? subjectOptions.find((option) => option.key === `volunteer-${appointment.volunteerId}`)
        : subjectOptions.find((option) => option.name === appointment.subjectName);
      setSubjectKey(subject?.key ?? null);
      setRemark(appointment.remark ?? '');
      return;
    }

    setStep('project');
    setProjectName('');
    setSessions([]);
    setRound(null);
    setSubjectKey(null);
    setRemark('');
  }, [appointment, open, subjectOptions]);

  async function handleFinalSubmit() {
    await onSubmit({
      volunteerId: selectedSubject?.volunteerId ?? null,
      subjectName: selectedSubject?.name ?? '',
      date,
      time,
      projectType: 'OTHER',
      projectName,
      session: sessions.length > 0 ? sessions.join('、') : null,
      round,
      remark: remark.trim() || null,
      status: 'BOOKED'
    });
  }

  function handleBack() {
    if (step === 'subject') {
      setStep('session');
      return;
    }

    if (step === 'session') {
      setStep('project');
    }
  }

  function handleForward() {
    if (step === 'project') {
      setStep('session');
      return;
    }

    if (step === 'session') {
      setStep('subject');
    }
  }

  const title = step === 'project'
    ? '请选择任务种类'
    : step === 'session'
      ? `请选择${projectName || '任务'}信息`
      : '请选择被试';

  return (
    <Modal
      className="appointment-wizard-modal"
      title={null}
      open={open}
      footer={null}
      width={1080}
      centered
      onCancel={onCancel}
      destroyOnClose
    >
      <div className="wizard-window">
        <div className="wizard-titlebar">
          <Button type="text" className="wizard-icon-button close" icon={<CloseCircleFilled />} onClick={onCancel} />
          <Button type="text" className="wizard-icon-button minimize" icon={<MinusCircleFilled />} />
          <Button type="text" className="wizard-arrow-button" icon={<LeftOutlined />} onClick={handleBack} disabled={step === 'project'} />
          <Button type="text" className="wizard-arrow-button" icon={<RightOutlined />} onClick={handleForward} disabled={step === 'subject'} />
          <Typography.Title level={2} className="wizard-title">
            {title}
          </Typography.Title>
        </div>

        <div className="wizard-body">
          {step === 'project' ? (
            <div className="wizard-project-grid">
              {projectConfigs.map((config, index) => (
                <Button
                  key={config.id}
                  className={`wizard-project-button ${projectButtonClasses[index % projectButtonClasses.length]}`}
                  onClick={() => {
                    setProjectName(config.name);
                    setSessions([]);
                    setRound(null);
                    setStep('session');
                  }}
                >
                  {config.name}
                </Button>
              ))}
            </div>
          ) : null}

          {step === 'session' ? (
            <>
              <Select
                value={round}
                options={roundSelectOptions}
                onChange={(value) => {
                  setRound(value);
                  setSessions([]);
                }}
                allowClear
                placeholder="选择轮数（可选）"
                className="wizard-session-select wizard-round-select"
                suffixIcon={<span>&lt;</span>}
              />
              <Select
                mode="multiple"
                value={sessions}
                options={sessionSelectOptions}
                onChange={setSessions}
                allowClear
                placeholder="选择 Session（可多选）"
                className="wizard-session-select"
              />
              <Button
                className="wizard-confirm-button"
                type="primary"
                onClick={() => setStep('subject')}
              >
                确认
              </Button>
            </>
          ) : null}

          {step === 'subject' ? (
            <div className="wizard-subject-layout">
              <div className="wizard-subject-picker">
                <Select
                  value={subjectKey}
                  showSearch
                  placeholder="请选择被试"
                  allowClear
                  optionFilterProp="label"
                  onChange={setSubjectKey}
                  className="wizard-subject-select"
                  options={subjectOptions.map((subject) => ({
                    value: subject.key,
                    label: subject.label
                  }))}
                />
              </div>

              <div className="wizard-remark-box">
                <Typography.Title level={4}>备注：</Typography.Title>
                <Input.TextArea
                  value={remark}
                  onChange={(event) => setRemark(event.target.value)}
                  bordered={false}
                  autoSize={{ minRows: 8, maxRows: 14 }}
                  placeholder="请输入备注"
                />
              </div>

              <Button
                className="wizard-confirm-button subject"
                type="primary"
                loading={confirmLoading}
                onClick={handleFinalSubmit}
              >
                确认
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
