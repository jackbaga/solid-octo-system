import { Form, Input, InputNumber, Modal, Select } from 'antd';
import { useEffect } from 'react';
import {
  statusOptions,
  statusesRequiringTeacher,
  teacherOptions
} from '../constants/volunteer';
import {
  CreateVolunteerPayload,
  Teacher,
  UpdateVolunteerPayload,
  Volunteer,
  VolunteerStatus
} from '../types/volunteer';

interface VolunteerFormValues {
  name: string;
  age?: number | null;
  phone: string;
  status?: VolunteerStatus;
  teacher?: Teacher | null;
}

interface VolunteerFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  volunteer?: Volunteer | null;
  confirmLoading?: boolean;
  onCancel: () => void;
  onSubmit: (payload: CreateVolunteerPayload | UpdateVolunteerPayload) => Promise<void>;
}

export function VolunteerFormModal({
  open,
  mode,
  volunteer,
  confirmLoading,
  onCancel,
  onSubmit
}: VolunteerFormModalProps) {
  const [form] = Form.useForm<VolunteerFormValues>();
  const status = Form.useWatch('status', form);
  const shouldShowTeacher = status ? statusesRequiringTeacher.includes(status) : false;

  function getCurrentFormValues(): VolunteerFormValues {
    if (mode === 'edit' && volunteer) {
      return {
        name: volunteer.name,
        age: volunteer.age,
        phone: volunteer.phone,
        status: volunteer.status,
        teacher: volunteer.teacher
      };
    }

    return {
      name: '',
      age: null,
      phone: '',
      status: 'NOT_CALLED',
      teacher: null
    };
  }

  function syncFormValues() {
    form.resetFields();
    form.setFieldsValue(getCurrentFormValues());
  }

  useEffect(() => {
    if (open) {
      syncFormValues();
      return;
    }

    form.resetFields();
  }, [form, mode, open, volunteer]);

  async function handleOk() {
    const values = await form.validateFields();
    const payload = {
      ...values,
      age: values.age ?? null,
      teacher: shouldShowTeacher ? values.teacher ?? null : null
    };

    await onSubmit(payload);
  }

  return (
    <Modal
      title={mode === 'create' ? '新增志愿者' : '编辑志愿者'}
      open={open}
      confirmLoading={confirmLoading}
      onCancel={onCancel}
      onOk={handleOk}
      afterOpenChange={(visible) => {
        if (visible) {
          syncFormValues();
        }
      }}
      okText={mode === 'edit' ? '保存' : '提交'}
      cancelText="取消"
      destroyOnClose
      forceRender
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="姓名"
          name="name"
          rules={[{ required: true, message: '请输入姓名' }]}
        >
          <Input placeholder="请输入姓名" />
        </Form.Item>

        <Form.Item label="年龄" name="age">
          <InputNumber min={1} max={120} precision={0} placeholder="请输入年龄" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="电话"
          name="phone"
          rules={[{ required: true, message: '请输入电话' }]}
        >
          <Input placeholder="请输入电话" />
        </Form.Item>

        <Form.Item
          label="状态"
          name="status"
          rules={[{ required: true, message: '请选择状态' }]}
        >
          <Select options={statusOptions} />
        </Form.Item>

        {shouldShowTeacher ? (
          <Form.Item label="负责老师" name="teacher">
            <Select allowClear options={teacherOptions} placeholder="请选择负责老师" />
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  );
}
