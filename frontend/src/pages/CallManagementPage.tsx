import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  UploadOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { Button, Layout, message, Popconfirm, Space, Table, Tag, Typography, Upload } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import { useEffect, useState } from 'react';
import { StatusFilter } from '../components/StatusFilter';
import { VolunteerFormModal } from '../components/VolunteerFormModal';
import { statusColors, statusLabels, teacherLabels } from '../constants/volunteer';
import {
  createVolunteer,
  deleteVolunteer,
  exportVolunteers,
  fetchVolunteers,
  importVolunteers,
  updateVolunteer
} from '../services/volunteerApi';
import {
  CreateVolunteerPayload,
  UpdateVolunteerPayload,
  Volunteer,
  VolunteerStatus
} from '../types/volunteer';

const { Header, Content } = Layout;

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

export function CallManagementPage() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [statusFilter, setStatusFilter] = useState<VolunteerStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVolunteer, setEditingVolunteer] = useState<Volunteer | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  async function loadVolunteers(nextStatus = statusFilter) {
    setLoading(true);
    try {
      const data = await fetchVolunteers(nextStatus);
      setVolunteers(data);
    } catch {
      messageApi.error('志愿者列表加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVolunteers();
  }, [statusFilter]);

  function openCreateModal() {
    setModalMode('create');
    setEditingVolunteer(null);
    setModalOpen(true);
  }

  function openEditModal(volunteer: Volunteer) {
    setModalMode('edit');
    setEditingVolunteer(volunteer);
    setModalOpen(true);
  }

  function closeVolunteerModal() {
    setModalOpen(false);
    setEditingVolunteer(null);
  }

  async function handleSubmit(payload: CreateVolunteerPayload | UpdateVolunteerPayload) {
    setModalLoading(true);
    try {
      if (modalMode === 'create') {
        await createVolunteer(payload as CreateVolunteerPayload);
        messageApi.success('志愿者已新增');
      } else if (editingVolunteer) {
        await updateVolunteer(editingVolunteer.id, payload as UpdateVolunteerPayload);
        messageApi.success('志愿者信息已更新');
      }

      closeVolunteerModal();
      await loadVolunteers();
    } catch {
      messageApi.error('保存失败，请检查输入后重试');
    } finally {
      setModalLoading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteVolunteer(id);
      messageApi.success('志愿者已删除');
      await loadVolunteers();
    } catch {
      messageApi.error('删除失败');
    }
  }

  const handleImport: UploadProps['customRequest'] = async ({ file, onError, onSuccess }) => {
    try {
      if (!(file instanceof File)) {
        throw new Error('请选择 .xlsx 文件');
      }

      const result = await importVolunteers(file);
      messageApi.success(`导入完成：新增 ${result.created} 条，更新 ${result.updated} 条`);
      await loadVolunteers();
      onSuccess?.(result);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      messageApi.error(errorMessage);
      onError?.(error as Error);
    }
  };

  async function handleExport() {
    try {
      const blob = await exportVolunteers(statusFilter);
      downloadBlob(blob, '志愿者名单.xlsx');
      messageApi.success('导出完成');
    } catch (error) {
      messageApi.error(getErrorMessage(error));
    }
  }

  const columns: ColumnsType<Volunteer> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 160
    },
    {
      title: '年龄',
      dataIndex: 'age',
      key: 'age',
      width: 100,
      render: (age: number | null) => age ?? '-'
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 180
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: VolunteerStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      )
    },
    {
      title: '负责老师',
      dataIndex: 'teacher',
      key: 'teacher',
      width: 140,
      render: (teacher: Volunteer['teacher']) => (teacher ? teacherLabels[teacher] : '-')
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该志愿者？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Layout className="app-shell">
      {contextHolder}
      <Header className="app-header">
        <Typography.Title level={3} className="app-title">
          CCBD-北大
        </Typography.Title>
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新增志愿者
          </Button>
          <Upload
            accept=".xlsx"
            customRequest={handleImport}
            maxCount={1}
            showUploadList={false}
          >
            <Button icon={<UploadOutlined />}>
              导入Excel
            </Button>
          </Upload>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出Excel
          </Button>
        </Space>
      </Header>

      <Content className="app-content">
        <div className="toolbar">
          <StatusFilter value={statusFilter} onChange={setStatusFilter} />
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={volunteers}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 900 }}
        />
      </Content>

      <VolunteerFormModal
        open={modalOpen}
        mode={modalMode}
        volunteer={editingVolunteer}
        confirmLoading={modalLoading}
        onCancel={closeVolunteerModal}
        onSubmit={handleSubmit}
      />
    </Layout>
  );
}
