import {
  CloseCircleFilled,
  LeftOutlined,
  MinusCircleFilled,
  RightOutlined
} from '@ant-design/icons';
import { Button, Input, Modal, Select, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import {
  appointmentProjectTypeLabels,
  roundOptions,
  sessionOptions,
  taskProjectTypes
} from '../constants/appointment';
import {
  Appointment,
  AppointmentPayload,
  AppointmentProjectType
} from '../types/appointment';
import { Teacher, Volunteer } from '../types/volunteer';
import { teacherLabels } from '../constants/volunteer';

type WizardStep = 'project' | 'session' | 'subject';

interface AppointmentFormModalProps {
  open: boolean;
  time: string;
  date: string;
  appointment?: Appointment | null;
  volunteers: Volunteer[];
  confirmLoading?: boolean;
  onCancel: () => void;
  onSubmit: (payload: AppointmentPayload) => Promise<void>;
}

const projectButtonClass: Record<AppointmentProjectType, string> = {
  MRI: 'project-blue',
  EEG: 'project-teal',
  COGNITION: 'project-green',
  INTERVIEW: 'project-yellow',
  PARENT_INTERVIEW: 'project-yellow',
  FORMAL_TEST: 'project-green',
  OTHER: 'project-blue'
};

function getTeacherName(teacher?: Teacher | null) {
  return teacher ? teacherLabels[teacher] : '未分配老师';
}

export function AppointmentFormModal({
  open,
  time,
  date,
  appointment,
  volunteers,
  confirmLoading,
  onCancel,
  onSubmit
}: AppointmentFormModalProps) {
  const [step, setStep] = useState<WizardStep>('project');
  const [projectType, setProjectType] = useState<AppointmentProjectType>('COGNITION');
  const [session, setSession] = useState('Session 1');
  const [round, setRound] = useState('第一轮');
  const [volunteerId, setVolunteerId] = useState<number | null>(null);
  const [remark, setRemark] = useState('');

  const selectedVolunteer = useMemo(
    () => volunteers.find((volunteer) => volunteer.id === volunteerId) ?? null,
    [volunteerId, volunteers]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    if (appointment) {
      setStep('subject');
      setProjectType(appointment.projectType);
      setSession(appointment.session || 'Session 1');
      setRound(appointment.round || '第一轮');
      setVolunteerId(appointment.volunteerId);
      setRemark(appointment.remark ?? '');
      return;
    }

    setStep('project');
    setProjectType('COGNITION');
    setSession('Session 1');
    setRound('第一轮');
    setVolunteerId(null);
    setRemark('');
  }, [appointment, open]);

  async function handleFinalSubmit() {
    if (!selectedVolunteer) {
      return;
    }

    await onSubmit({
      volunteerId: selectedVolunteer.id,
      subjectName: selectedVolunteer.name,
      date,
      time,
      projectType,
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
      ? `请选择${appointmentProjectTypeLabels[projectType]}任务`
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
              {taskProjectTypes.map((type) => (
                <Button
                  key={type}
                  className={`wizard-project-button ${projectButtonClass[type]}`}
                  onClick={() => {
                    setProjectType(type);
                    setStep('session');
                  }}
                >
                  {appointmentProjectTypeLabels[type]}
                </Button>
              ))}
            </div>
          ) : null}

          {step === 'session' ? (
            <>
              <Select
                value={round}
                options={roundOptions}
                onChange={setRound}
                className="wizard-session-select"
                suffixIcon={<span>&lt;</span>}
              />
              <div className="wizard-session-grid">
                {sessionOptions.map((item) => (
                  <Button
                    key={item.value}
                    className={`wizard-project-button ${projectButtonClass[projectType]}`}
                    onClick={() => {
                      setSession(item.value);
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
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
                  optionFilterProp="label"
                  onChange={setVolunteerId}
                  className="wizard-subject-select"
                  options={volunteers.map((volunteer) => ({
                    value: volunteer.id,
                    label: `${volunteer.name}（${getTeacherName(volunteer.teacher)}）`
                  }))}
                />
                <div className="wizard-subject-list">
                  {volunteers.slice(0, 10).map((volunteer) => (
                    <button
                      key={volunteer.id}
                      type="button"
                      className={volunteer.id === volunteerId ? 'selected' : ''}
                      onClick={() => setVolunteerId(volunteer.id)}
                    >
                      {volunteer.name}
                    </button>
                  ))}
                </div>
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
                disabled={!selectedVolunteer}
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
