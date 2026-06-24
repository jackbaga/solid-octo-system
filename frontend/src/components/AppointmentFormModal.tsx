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
  confirmLoading?: boolean;
  onCancel: () => void;
  onSubmit: (payload: AppointmentPayload) => Promise<void>;
}

const projectButtonClasses = ['project-blue', 'project-teal', 'project-green', 'project-yellow'];
const chineseRoundNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

function getTeacherName(teacher?: Teacher | null) {
  return teacher ? teacherLabels[teacher] : '未分配老师';
}

export function AppointmentFormModal({
  open,
  time,
  date,
  appointment,
  taskConfigs,
  volunteers,
  confirmLoading,
  onCancel,
  onSubmit
}: AppointmentFormModalProps) {
  const [step, setStep] = useState<WizardStep>('project');
  const [projectName, setProjectName] = useState('');
  const [session, setSession] = useState<string | null>(null);
  const [round, setRound] = useState<string | null>(null);
  const [volunteerId, setVolunteerId] = useState<number | null>(null);
  const [remark, setRemark] = useState('');

  const selectedVolunteer = useMemo(
    () => volunteers.find((volunteer) => volunteer.id === volunteerId) ?? null,
    [volunteerId, volunteers]
  );
  const selectedTaskConfig = useMemo(
    () => taskConfigs.find((config) => config.name === projectName) ?? null,
    [projectName, taskConfigs]
  );
  const sessionSelectOptions = (selectedTaskConfig?.sessions ?? []).map((value) => ({ value, label: value }));
  const roundSelectOptions = (selectedTaskConfig?.rounds ?? []).map((value) => {
    const label = `第${chineseRoundNumbers[value - 1] ?? value}轮`;
    return { value: label, label };
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    if (appointment) {
      setStep('subject');
      setProjectName(appointment.projectName || '');
      setSession(appointment.session ?? null);
      setRound(appointment.round ?? null);
      setVolunteerId(appointment.volunteerId);
      setRemark(appointment.remark ?? '');
      return;
    }

    setStep('project');
    setProjectName('');
    setSession(null);
    setRound(null);
    setVolunteerId(null);
    setRemark('');
  }, [appointment, open]);

  async function handleFinalSubmit() {
    await onSubmit({
      volunteerId: selectedVolunteer?.id ?? null,
      subjectName: selectedVolunteer?.name ?? '',
      date,
      time,
      projectType: 'OTHER',
      projectName,
      session,
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
              {taskConfigs.map((config, index) => (
                <Button
                  key={config.id}
                  className={`wizard-project-button ${projectButtonClasses[index % projectButtonClasses.length]}`}
                  onClick={() => {
                    setProjectName(config.name);
                    setSession(null);
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
                value={session}
                options={sessionSelectOptions}
                onChange={setSession}
                allowClear
                placeholder="选择 Session（可选）"
                className="wizard-session-select"
                suffixIcon={<span>&lt;</span>}
              />
              <Select
                value={round}
                options={roundSelectOptions}
                onChange={setRound}
                allowClear
                placeholder="选择轮数（可选）"
                className="wizard-session-select wizard-round-select"
                suffixIcon={<span>&lt;</span>}
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
                  value={volunteerId}
                  showSearch
                  placeholder="请选择被试"
                  allowClear
                  optionFilterProp="label"
                  onChange={setVolunteerId}
                  className="wizard-subject-select"
                  options={volunteers.map((volunteer) => ({
                    value: volunteer.id,
                    label: `${volunteer.name}（${getTeacherName(volunteer.teacher)}）`
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
