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
  account?: string | null;
  password?: string | null;
  status?: VolunteerStatus;
  teacher?: Teacher | null;
  remark?: string | null;
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
        account: volunteer.account,
        password: volunteer.password,
        status: volunteer.status,
        teacher: volunteer.teacher,
        remark: volunteer.remark
      };
    }

    return {
      name: '',
      age: null,
      phone: '',
      account: '',
      password: '',
      status: 'NOT_CALLED',
      teacher: null,
      remark: ''
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
      teacher: shouldShowTeacher ? values.teacher ?? null : null,
      remark: values.remark?.trim() || null
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

        <Form.Item label="账号" name="account">
          <Input placeholder="请输入账号" />
        </Form.Item>

        <Form.Item label="密码" name="password">
          <Input placeholder="请输入密码" />
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

        <Form.Item label="备注" name="remark">
          <Input.TextArea rows={3} placeholder="请输入备注" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
