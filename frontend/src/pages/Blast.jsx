import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Badge,
  Button,
  Card,
  Col,
  Form,
  ProgressBar,
  Row,
} from 'react-bootstrap';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { blastAPI, contactsAPI, templatesAPI } from '../services/api';

const steps = [
  'Select Contacts',
  'Choose Template',
  'Configure',
  'Review & Send',
];

const listRowHeight = 52;
const BACKEND_URL = 'http://localhost:3001';

function toTimeValue(date) {
  return new Date(date).toISOString().slice(0, 16);
}

export default function Blast() {
  const [currentStep, setCurrentStep] = useState(1);
  const [contacts, setContacts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [sessionOptions, setSessionOptions] = useState([]);
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('all');
  const [delay, setDelay] = useState(3000);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleAt, setScheduleAt] = useState(toTimeValue(Date.now() + 30 * 60 * 1000));
  const [sessionName, setSessionName] = useState('Default Session');
  const [sending, setSending] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [contactRes, templateRes, sessionsRes] = await Promise.all([
        contactsAPI.getAll(),
        templatesAPI.getAll(),
        blastAPI.getSessions(),
      ]);
      setContacts(contactRes.data || []);
      setTemplates(templateRes.data || []);
      setSessionOptions((sessionsRes.data || []).slice(0, 8));
    } catch (error) {
      toast.error('Failed to load blast setup data');
    }
  }

  const groups = useMemo(() => {
    return Array.from(new Set(contacts.map((contact) => contact.group_name || 'default')));
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const matchSearch =
        contact.name?.toLowerCase().includes(search.toLowerCase()) ||
        contact.phone?.toLowerCase().includes(search.toLowerCase());
      const matchGroup = filterGroup === 'all' || (contact.group_name || 'default') === filterGroup;
      return matchSearch && matchGroup;
    });
  }, [contacts, search, filterGroup]);

  const containerHeight = 330;
  const visibleCount = Math.ceil(containerHeight / listRowHeight) + 6;
  const start = Math.max(0, Math.floor(scrollTop / listRowHeight) - 3);
  const end = Math.min(filteredContacts.length, start + visibleCount);
  const visibleContacts = filteredContacts.slice(start, end);

  const topPad = start * listRowHeight;
  const bottomPad = Math.max(0, (filteredContacts.length - end) * listRowHeight);

  function toggleContact(id) {
    setSelectedContactIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function nextStep() {
    if (currentStep === 1 && selectedContactIds.length === 0) {
      toast.error('Please select at least one contact');
      return;
    }
    if (currentStep === 2 && !selectedTemplate) {
      toast.error('Please choose a template');
      return;
    }
    setCurrentStep((prev) => Math.min(4, prev + 1));
  }

  function prevStep() {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  }

  async function startBlast() {
    if (!selectedTemplate || selectedContactIds.length === 0) return;

    setSending(true);
    try {
      await blastAPI.start({
        name: sessionName,
        message: selectedTemplate.content,
        template_media_path: selectedTemplate.media_path || undefined,
        delay_min: Number(delay),
        delay_max: Number(delay + 1500),
        group_name: filterGroup === 'all' ? contacts[0]?.group_name || 'default' : filterGroup,
        contact_ids: selectedContactIds,
        schedule_at: scheduleEnabled ? scheduleAt : undefined,
      });
      toast.success('Blast started successfully');
      setCurrentStep(1);
      setSelectedContactIds([]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to start blast');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page-enter-active">
      <PageHeader title="Blast" subtitle="Create and launch campaigns in guided steps" />

      <Row className="g-3">
        <Col md={4}>
          <Card className="surface-card h-100">
            <Card.Body>
              <div className="d-md-none mb-3 wizard-mobile-progress">
                <div className="d-flex justify-content-between small text-secondary mb-1">
                  <span>Step {currentStep} of 4</span>
                  <span>{steps[currentStep - 1]}</span>
                </div>
                <ProgressBar now={(currentStep / 4) * 100} />
              </div>

              <div className="d-none d-md-block">
                {steps.map((step, index) => {
                  const number = index + 1;
                  const active = currentStep === number;
                  const completed = currentStep > number;
                  return (
                    <div key={step} className={`wizard-step ${active ? 'active' : ''} ${completed ? 'completed' : ''}`}>
                      <span className="step-circle">{completed ? <i className="bi bi-check" /> : number}</span>
                      <div>
                        <div className={`small ${active ? 'fw-semibold' : 'text-secondary'}`}>{step}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={8}>
          <Card className="surface-card h-100">
            <Card.Body>
              {currentStep === 1 ? (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h3 className="mb-0">Select Contacts</h3>
                    <Badge bg="success">{selectedContactIds.length} selected</Badge>
                  </div>

                  <Row className="g-2 mb-2">
                    <Col md={7}>
                      <Form.Control
                        placeholder="Search contacts"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </Col>
                    <Col md={5}>
                      <Form.Select value={filterGroup} onChange={(event) => setFilterGroup(event.target.value)}>
                        <option value="all">All Groups</option>
                        {groups.map((group) => (
                          <option key={group} value={group}>{group}</option>
                        ))}
                      </Form.Select>
                    </Col>
                  </Row>

                  <div className="virtual-scroll" ref={listRef} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
                    <table className="table mb-0">
                      <tbody>
                        {topPad > 0 ? (
                          <tr style={{ height: topPad }}>
                            <td colSpan={3} />
                          </tr>
                        ) : null}

                        {visibleContacts.map((contact) => (
                          <tr key={contact.id} style={{ height: listRowHeight }}>
                            <td style={{ width: 42 }}>
                              <Form.Check
                                checked={selectedContactIds.includes(contact.id)}
                                onChange={() => toggleContact(contact.id)}
                                aria-label={`Select ${contact.name}`}
                              />
                            </td>
                            <td>
                              <div className="fw-medium">{contact.name}</div>
                              <div className="small text-secondary">{contact.phone}</div>
                            </td>
                            <td className="text-secondary">{contact.group_name}</td>
                          </tr>
                        ))}

                        {bottomPad > 0 ? (
                          <tr style={{ height: bottomPad }}>
                            <td colSpan={3} />
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {currentStep === 2 ? (
                <>
                  <h3 className="mb-3">Choose Template</h3>
                  <Row className="g-3">
                    {templates.map((template) => {
                      const isSelected = selectedTemplate?.id === template.id;
                      return (
                        <Col md={6} key={template.id}>
                          <Card
                            className="h-100"
                            style={{
                              border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                              cursor: 'pointer',
                              position: 'relative',
                            }}
                            onClick={() => setSelectedTemplate(template)}
                          >
                            <Card.Body>
                              {isSelected ? (
                                <span className="position-absolute top-0 end-0 m-2 badge bg-success">
                                  <i className="bi bi-check2" />
                                </span>
                              ) : null}
                              <div className="fw-semibold mb-2">{template.name}</div>
                              <div className="small text-secondary" style={{ minHeight: 64 }}>
                                {template.content.slice(0, 120)}
                              </div>
                              {template.media_path ? (
                                <div className="small mt-2 d-flex align-items-center gap-2">
                                  <i className={`bi ${String(template.media_type || '').startsWith('image/') ? 'bi-image' : 'bi-file-earmark-text'}`} />
                                  <span>Has attachment</span>
                                </div>
                              ) : null}
                            </Card.Body>
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                </>
              ) : null}

              {currentStep === 3 ? (
                <>
                  <h3 className="mb-3">Configure Campaign</h3>

                  <Form.Group className="mb-3">
                    <Form.Label>Delay Between Messages (ms)</Form.Label>
                    <div className="d-flex align-items-center gap-2">
                      <Form.Range min={1000} max={10000} value={delay} onChange={(event) => setDelay(Number(event.target.value))} />
                      <Form.Control
                        type="number"
                        min={1000}
                        value={delay}
                        onChange={(event) => setDelay(Number(event.target.value || 1000))}
                        style={{ width: 120 }}
                      />
                    </div>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Check
                      type="switch"
                      checked={scheduleEnabled}
                      onChange={(event) => setScheduleEnabled(event.target.checked)}
                      label="Schedule campaign"
                    />
                    {scheduleEnabled ? (
                      <Form.Control
                        className="mt-2"
                        type="datetime-local"
                        value={scheduleAt}
                        onChange={(event) => setScheduleAt(event.target.value)}
                      />
                    ) : null}
                  </Form.Group>

                  <Form.Group>
                    <Form.Label>Session Selector</Form.Label>
                    <Form.Select value={sessionName} onChange={(event) => setSessionName(event.target.value)}>
                      <option value="Default Session">Default Session</option>
                      {sessionOptions.map((session) => (
                        <option key={session.id} value={session.name}>{session.name}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </>
              ) : null}

              {currentStep === 4 ? (
                <>
                  <h3 className="mb-3">Review & Send</h3>
                  <Card className="border">
                    <Card.Body>
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-secondary">Contacts</span>
                        <span className="fw-semibold">{selectedContactIds.length}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-secondary">Template</span>
                        <span className="fw-semibold">{selectedTemplate?.name || '-'}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-secondary">Schedule</span>
                        <span className="fw-semibold">
                          {scheduleEnabled ? new Date(scheduleAt).toLocaleString() : 'Send immediately'}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between mb-3">
                        <span className="text-secondary">Delay</span>
                        <span className="fw-semibold">{delay}ms</span>
                      </div>

                      <div className="p-3 rounded-3 border" style={{ background: '#ece5dd' }}>
                        <div className="rounded-3 bg-white p-3 shadow-sm" style={{ maxWidth: 420 }}>
                          {selectedTemplate?.content}
                          {selectedTemplate?.media_path ? (
                            <div className="mt-3 border-top pt-2">
                              {String(selectedTemplate.media_type || '').startsWith('image/') ? (
                                <img
                                  src={`${BACKEND_URL}${selectedTemplate.media_path}`}
                                  alt={selectedTemplate.media_name || 'Attachment'}
                                  style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8 }}
                                />
                              ) : (
                                <div className="small d-flex align-items-center gap-2">
                                  <i className="bi bi-file-earmark-text" />
                                  <span>{selectedTemplate.media_name || 'Document attachment'}</span>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </Card.Body>
                  </Card>

                  <Button className="w-100 mt-3 py-2" size="lg" disabled={sending} onClick={startBlast}>
                    {sending ? 'Starting...' : 'Start Blast'}
                  </Button>
                </>
              ) : null}

              <div className="d-flex justify-content-between mt-4">
                <Button variant="light" className="btn-outline-soft" onClick={prevStep} disabled={currentStep === 1}>
                  Back
                </Button>
                {currentStep < 4 ? <Button onClick={nextStep}>Continue</Button> : <StatusBadge status="active" text="Ready" />}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
