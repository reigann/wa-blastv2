import { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import {
  Button,
  Card,
  Col,
  Form,
  Modal,
  Pagination,
  Row,
  Table
} from 'react-bootstrap';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { contactsAPI } from '../services/api';

const formSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  group: z.string().min(1, 'Group is required'),
  tags: z.string().optional(),
  notes: z.string().optional(),
});

const rowHeight = 58;

function hashToColor(input = '') {
  const palette = ['#4f46e5', '#0ea5e9', '#16a34a', '#f97316', '#e11d48', '#7c3aed', '#1d4ed8'];
  const value = input.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return palette[value % palette.length];
}

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [page, setPage] = useState(1);
  const [scrollTop, setScrollTop] = useState(0);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);
  const listRef = useRef(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewGroup, setPreviewGroup] = useState('default');
  const [previewDetected, setPreviewDetected] = useState(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '',
      phone: '',
      group: 'default',
      tags: '',
      notes: '',
    },
  });

  useEffect(() => {
    loadContacts();
    loadGroups();
  }, []);

  useEffect(() => {
    setPage(1);
    setScrollTop(0);
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [search, selectedGroup, statusFilter]);

  async function loadContacts() {
    setLoading(true);
    try {
      const response = await contactsAPI.getAll();
      setContacts(response.data || []);
    } catch (error) {
      toast.error('Failed to load contacts');
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadGroups() {
    try {
      const response = await contactsAPI.getGroups();
      setGroupOptions(response.data || []);
    } catch (error) {
      setGroupOptions([]);
    }
  }

  function openAddModal() {
    setEditingContact(null);
    reset({ name: '', phone: '', group: 'default', tags: '', notes: '' });
    setModalOpen(true);
  }

  function openEditModal(contact) {
    setEditingContact(contact);
    reset({
      name: contact.name || '',
      phone: contact.phone || '',
      group: contact.group_name || 'default',
      tags: contact.minat_prodi || '',
      notes: contact.asal_sekolah || '',
    });
    setModalOpen(true);
  }

  async function onSubmit(formValues) {
    const parsed = formSchema.safeParse(formValues);

    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const path = issue.path[0];
        if (path) {
          setError(path, { message: issue.message });
        }
      });
      return;
    }

    const payload = {
      name: parsed.data.name,
      phone: parsed.data.phone,
      group_name: parsed.data.group,
      minat_prodi: parsed.data.tags || 'unknown',
      asal_sekolah: parsed.data.notes || 'unknown',
    };

    try {
      if (editingContact?.id) {
        await contactsAPI.update(editingContact.id, payload);
      } else {
        await contactsAPI.add(payload);
      }
      toast.success(editingContact ? 'Contact updated' : 'Contact added');
      setModalOpen(false);
      setEditingContact(null);
      reset();
      await Promise.all([loadContacts(), loadGroups()]);
    } catch (error) {
      toast.error('Unable to save contact');
    }
  }

  async function deleteContact(id) {
    try {
      await contactsAPI.delete(id);
      toast.success('Contact deleted');
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      await Promise.all([loadContacts(), loadGroups()]);
    } catch (error) {
      toast.error('Delete failed');
    }
  }

  function handleCsvUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    const groupName = selectedGroup === 'all' ? 'default' : selectedGroup;
    formData.append('group_name', groupName);
    setPreviewGroup(groupName);

    toast.promise(
      contactsAPI.previewUpload(formData).then(r => {
        const rows = (r.data.rows || []).map((row) => ({ ...row, selected: true }));
        setPreviewRows(rows);
        setPreviewTotal(r.data.total || rows.length);
        setPreviewDetected(r.data.detected || null);
        setPreviewOpen(true);
        return r.data;
      }),
      {
        loading: 'Preparing CSV preview...',
        success: 'Preview ready',
        error: 'Preview failed',
      }
    );
  }

  function updatePreviewRow(idx, field, value) {
    setPreviewRows(prev => prev.map(r => r.__idx === idx ? { ...r, [field]: value } : r));
  }

  async function importPreviewSelected() {
    const toImport = previewRows.filter(r => r.selected).map(r => ({
      name: r.name,
      phone: r.phone,
      minat_prodi: r.minat_prodi,
      asal_sekolah: r.asal_sekolah
    }));

    if (toImport.length === 0) {
      toast.error('No rows selected to import');
      return;
    }

    try {
      await toast.promise(
        contactsAPI.importContacts({ rows: toImport, group_name: previewGroup }),
        {
          loading: 'Importing contacts...',
          success: d => `Imported ${d.data.imported} contacts (${d.data.skipped} skipped)`,
          error: 'Import failed',
        }
      );
      setPreviewOpen(false);
      setPreviewRows([]);
      await Promise.all([loadContacts(), loadGroups()]);
    } catch (err) {
      console.error(err);
    }
  }

  function exportCsv() {
    const csv = Papa.unparse(filteredRows.map((contact) => ({
      name: contact.name,
      phone: contact.phone,
      group: contact.group_name,
      tags: contact.minat_prodi || '',
      notes: contact.asal_sekolah || '',
    })));

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredRows = useMemo(() => {
    return contacts.filter((contact) => {
      const matchSearch =
        contact.name?.toLowerCase().includes(search.toLowerCase()) ||
        contact.phone?.toLowerCase().includes(search.toLowerCase());

      const group = contact.group_name || 'default';
      const matchGroup = selectedGroup === 'all' || group === selectedGroup;

      const status = contact.status || 'active';
      const matchStatus = statusFilter === 'all' || status === statusFilter;

      return matchSearch && matchGroup && matchStatus;
    });
  }, [contacts, search, selectedGroup, statusFilter]);

  const tagOptions = useMemo(() => {
    const unique = new Set();
    contacts.forEach((contact) => {
      const raw = String(contact.minat_prodi || '').trim();
      if (!raw) return;
      raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => {
          if (item.toLowerCase() !== 'unknown') {
            unique.add(item);
          }
        });
    });
    return Array.from(unique).slice(0, 24);
  }, [contacts]);

  function appendTag(tag) {
    const current = String(getValues('tags') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!current.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      current.push(tag);
    }
    setValue('tags', current.join(', '), { shouldDirty: true });
  }

  const pageSize = 40;
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * pageSize;
  const pageRows = filteredRows.slice(startIndex, startIndex + pageSize);
  const totalContacts = contacts.length;

  const containerHeight = 420;
  const visibleCount = Math.ceil(containerHeight / rowHeight) + 6;
  const virtualStart = Math.max(0, Math.floor(scrollTop / rowHeight) - 3);
  const virtualEnd = Math.min(pageRows.length, virtualStart + visibleCount);
  const visibleRows = pageRows.slice(virtualStart, virtualEnd);

  const spacerTop = virtualStart * rowHeight;
  const spacerBottom = Math.max(0, (pageRows.length - virtualEnd) * rowHeight);

  const rangeStart = pageRows.length ? startIndex + 1 : 0;
  const rangeEnd = startIndex + pageRows.length;

  return (
    <div className="page-enter-active">
      <PageHeader
        title="Contacts"
        subtitle="Manage recipients, groups, and segmentation tags for your blast campaigns"
        actions={[
          <Button key="import" variant="light" className="btn-outline-soft" onClick={() => fileRef.current?.click()}>
            <i className="bi bi-upload me-2" />Import CSV
          </Button>,
          <Button key="add" onClick={openAddModal}>
            <i className="bi bi-person-plus me-2" />Add Contact
          </Button>,
        ]}
      />

      <input ref={fileRef} type="file" accept=".csv" className="d-none" onChange={handleCsvUpload} />

      <Card className="surface-card mb-3">
        <Card.Body>
          <Row className="g-2">
            <Col md={4}>
              <Form.Control
                placeholder="Search name or phone"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Col>
            <Col md={3}>
              <Form.Select value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)}>
                <option value="all">All Groups</option>
                {groupOptions.map((group) => (
                  <option key={group.group_name} value={group.group_name}>
                    {group.group_name} ({group.count})
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Button variant="light" className="btn-outline-soft w-100" onClick={exportCsv}>
                <i className="bi bi-download me-2" />Export
              </Button>
            </Col>
          </Row>

          <Row className="g-2 mt-3">
            <Col md={4}>
              <div className="rounded-3 border bg-body-tertiary px-3 py-2 h-100">
                <div className="text-secondary small mb-1">Total Contacts</div>
                <div className="fs-4 fw-bold lh-1">{totalContacts}</div>
              </div>
            </Col>
            <Col md={4}>
              <div className="rounded-3 border bg-body-tertiary px-3 py-2 h-100">
                <div className="text-secondary small mb-1">Filtered Contacts</div>
                <div className="fs-4 fw-bold lh-1">{filteredRows.length}</div>
              </div>
            </Col>
            <Col md={4}>
              <div className="rounded-3 border bg-body-tertiary px-3 py-2 h-100">
                <div className="text-secondary small mb-1">Selected Contacts</div>
                <div className="fs-4 fw-bold lh-1">{selectedIds.length}</div>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="surface-card">
        {loading ? (
          <div className="p-4 text-secondary">Loading contacts...</div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            icon="bi-people"
            title="No contacts yet"
            description="Start by adding your first contact or importing a CSV file"
            ctaLabel="Add Contact"
            onCta={openAddModal}
          />
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>
                      <Form.Check
                        checked={pageRows.length > 0 && pageRows.every((row) => selectedIds.includes(row.id))}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedIds((prev) => Array.from(new Set([...prev, ...pageRows.map((item) => item.id)])));
                          } else {
                            setSelectedIds((prev) => prev.filter((id) => !pageRows.some((row) => row.id === id)));
                          }
                        }}
                      />
                    </th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Group</th>
                    <th className="table-mobile-hide">Tags</th>
                    <th>Status</th>
                    <th style={{ width: 100 }}>Actions</th>
                  </tr>
                </thead>
              </table>
            </div>

            <div
              className="virtual-scroll"
              ref={listRef}
              onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            >
              <table className="table table-hover align-middle mb-0">
                <tbody>
                  {spacerTop > 0 ? (
                    <tr style={{ height: spacerTop }}>
                      <td colSpan={7} />
                    </tr>
                  ) : null}

                  {visibleRows.map((contact) => {
                    const status = contact.status || 'active';
                    const bg = hashToColor(contact.name || contact.phone);
                    const tagText = contact.minat_prodi || 'General';
                    return (
                      <tr key={contact.id} style={{ height: rowHeight }}>
                        <td>
                          <Form.Check
                            checked={selectedIds.includes(contact.id)}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setSelectedIds((prev) => [...prev, contact.id]);
                              } else {
                                setSelectedIds((prev) => prev.filter((id) => id !== contact.id));
                              }
                            }}
                          />
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <span className="avatar-circle" style={{ background: bg }}>
                              {initials(contact.name)}
                            </span>
                            <div>
                              <div className="fw-medium">{contact.name}</div>
                              <div className="small text-secondary">#{contact.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="font-monospace">{contact.phone}</td>
                        <td>
                          <span
                            className="badge"
                            style={{ background: `${hashToColor(contact.group_name)}22`, color: hashToColor(contact.group_name) }}
                          >
                            {contact.group_name}
                          </span>
                        </td>
                        <td className="table-mobile-hide text-secondary">{tagText}</td>
                        <td>
                          <StatusBadge status={status} text={status} />
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-sm btn-light border"
                              onClick={() => openEditModal(contact)}
                              aria-label="Edit contact"
                            >
                              <i className="bi bi-pencil" />
                            </button>
                            <button
                              className="btn btn-sm btn-light border text-danger"
                              onClick={() => deleteContact(contact.id)}
                              aria-label="Delete contact"
                            >
                              <i className="bi bi-trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {spacerBottom > 0 ? (
                    <tr style={{ height: spacerBottom }}>
                      <td colSpan={7} />
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-between align-items-center p-3 border-top">
              <small className="text-secondary">Showing {rangeStart}-{rangeEnd} of {filteredRows.length}</small>
              <Pagination className="mb-0">
                <Pagination.Prev disabled={currentPage === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))} />
                <Pagination.Item active>{currentPage}</Pagination.Item>
                <Pagination.Next
                  disabled={currentPage === pageCount}
                  onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
                />
              </Pagination>
            </div>
          </>
        )}
      </Card>

      <Modal show={modalOpen} onHide={() => setModalOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingContact ? 'Edit Contact' : 'Add Contact'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit(onSubmit)}>
            <Form.Group className="mb-3">
              <Form.Label>Name *</Form.Label>
              <Form.Control {...register('name')} />
              {errors.name ? <small className="text-danger">{errors.name.message}</small> : null}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Phone *</Form.Label>
              <Form.Control {...register('phone')} />
              {errors.phone ? <small className="text-danger">{errors.phone.message}</small> : null}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Group</Form.Label>
              <Form.Control {...register('group')} list="contact-group-options" placeholder="Type or select existing group" />
              <datalist id="contact-group-options">
                {groupOptions.map((group) => (
                  <option key={group.group_name} value={group.group_name} />
                ))}
              </datalist>
              {groupOptions.length > 0 ? (
                <div className="d-flex flex-wrap gap-1 mt-2">
                  {groupOptions.slice(0, 6).map((group) => (
                    <button
                      key={`quick-${group.group_name}`}
                      type="button"
                      className="btn btn-sm btn-light border"
                      onClick={() => setValue('group', group.group_name)}
                    >
                      {group.group_name}
                    </button>
                  ))}
                </div>
              ) : null}
              {errors.group ? <small className="text-danger">{errors.group.message}</small> : null}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Tags</Form.Label>
              <Form.Control
                {...register('tags')}
                list="contact-tag-options"
                placeholder="vip, warm lead"
              />
              <datalist id="contact-tag-options">
                {tagOptions.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
              {tagOptions.length > 0 ? (
                <div className="d-flex flex-wrap gap-1 mt-2">
                  {tagOptions.slice(0, 8).map((tag) => (
                    <button
                      key={`quick-tag-${tag}`}
                      type="button"
                      className="btn btn-sm btn-light border"
                      onClick={() => appendTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              ) : null}
            </Form.Group>

            <Form.Group className="mb-0">
              <Form.Label>Notes</Form.Label>
              <Form.Control as="textarea" rows={3} {...register('notes')} />
            </Form.Group>

            <div className="d-flex justify-content-end gap-2 mt-4">
              <Button variant="light" className="btn-outline-soft" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editingContact ? 'Update' : 'Create'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
      {/* CSV Preview Modal */}
      <Modal show={previewOpen} onHide={() => setPreviewOpen(false)} size="lg" centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title>CSV Preview — Showing {previewRows.length} of {previewTotal} rows</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {previewDetected && (
            <div className="mb-3 text-muted">Detected columns: {previewDetected.nameColumn}, {previewDetected.phoneColumn}</div>
          )}

          <div className="table-responsive" style={{ maxHeight: '50vh', overflow: 'auto' }}>
            <Table size="sm" bordered>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <Form.Check
                      checked={previewRows.length > 0 && previewRows.every(r => r.selected)}
                      onChange={(e) => setPreviewRows(prev => prev.map(r => ({ ...r, selected: e.target.checked })))}
                    />
                  </th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Tags / Prodi</th>
                  <th>School</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r) => (
                  <tr key={r.__idx}>
                    <td>
                      <Form.Check
                        checked={!!r.selected}
                        onChange={(e) => setPreviewRows(prev => prev.map(it => it.__idx === r.__idx ? { ...it, selected: e.target.checked } : it))}
                      />
                    </td>
                    <td>
                      <Form.Control size="sm" value={r.name} onChange={(e) => updatePreviewRow(r.__idx, 'name', e.target.value)} />
                    </td>
                    <td>
                      <Form.Control size="sm" value={r.phone} onChange={(e) => updatePreviewRow(r.__idx, 'phone', e.target.value)} />
                    </td>
                    <td>
                      <Form.Control size="sm" value={r.minat_prodi} onChange={(e) => updatePreviewRow(r.__idx, 'minat_prodi', e.target.value)} />
                    </td>
                    <td>
                      <Form.Control size="sm" value={r.asal_sekolah} onChange={(e) => updatePreviewRow(r.__idx, 'asal_sekolah', e.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setPreviewOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={importPreviewSelected}>Import Selected ({previewRows.filter(r => r.selected).length})</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
