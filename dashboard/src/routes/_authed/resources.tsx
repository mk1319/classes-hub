import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { ScopePicker, type Scope } from '@/components/ScopePicker';
import { DataTable, type Column } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  resourceFileUrl,
  useCreateResource,
  useDeleteResource,
  useResources,
  type Resource,
  type ResourceType,
} from '@/features/resources/api';

export const Route = createFileRoute('/_authed/resources')({ component: ResourcesPage });

function ResourcesPage() {
  const [scope, setScope] = useState<Scope>({ courseId: 0, subjectId: 0, batchId: 0 });
  const filters = scope.batchId ? { batchId: scope.batchId } : scope.subjectId ? { subjectId: scope.subjectId } : {};
  const { data, isLoading } = useResources(filters);
  const del = useDeleteResource();

  const columns: Column<Resource>[] = [
    { key: 'title', header: 'Title', render: (r) => <span className="font-medium">{r.title}</span>, sortValue: (r) => r.title },
    { key: 'type', header: 'Type', render: (r) => <Badge>{r.type}</Badge>, sortValue: (r) => r.type },
    {
      key: 'storage',
      header: 'Source',
      render: (r) => (r.storage_type === 'link' ? <Badge tone="primary">link</Badge> : <Badge tone="success">upload</Badge>),
    },
    {
      key: 'open',
      header: '',
      render: (r) => {
        const href = r.storage_type === 'link' ? r.link_url! : resourceFileUrl(r.id);
        return (
          <div className="flex gap-2">
            <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">
              Open
            </a>
            <Button variant="ghost" size="sm" onClick={() => del.mutate(r.id)}>
              Delete
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader title="Resources" description="Study materials attached to a subject (all its batches) or a single batch." />
      <ScopePicker onChange={setScope} />
      {scope.subjectId > 0 && <NewResourceForm scope={scope} />}
      <DataTable columns={columns} rows={data} isLoading={isLoading} getRowKey={(r) => r.id} filterPlaceholder="Filter resources…" emptyMessage="No resources here yet." />
    </div>
  );
}

function NewResourceForm({ scope }: { scope: Scope }) {
  const create = useCreateResource();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ResourceType>('pdf');
  const [attachTo, setAttachTo] = useState<'subject' | 'batch'>('subject');
  const [storageType, setStorageType] = useState<'link' | 'upload'>('link');
  const [linkUrl, setLinkUrl] = useState('');
  const [file, setFile] = useState<{ filename: string; mimeType: string; dataBase64: string } | null>(null);

  const canAttachBatch = scope.batchId > 0;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const buf = await f.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    setFile({ filename: f.name, mimeType: f.type || 'application/octet-stream', dataBase64: b64 });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      subjectId: attachTo === 'subject' ? scope.subjectId : undefined,
      batchId: attachTo === 'batch' ? scope.batchId : undefined,
      type,
      title,
      storageType,
      linkUrl: storageType === 'link' ? linkUrl : undefined,
      file: storageType === 'upload' ? file ?? undefined : undefined,
    });
    setTitle('');
    setLinkUrl('');
    setFile(null);
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Add resource</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onChange={(e) => setType(e.target.value as ResourceType)} className="w-full">
              <option value="pdf">PDF</option>
              <option value="document">Document</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Attach to</Label>
            <Select value={attachTo} onChange={(e) => setAttachTo(e.target.value as 'subject' | 'batch')} className="w-full">
              <option value="subject">Subject (all batches)</option>
              <option value="batch" disabled={!canAttachBatch}>
                This batch only
              </option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={storageType} onChange={(e) => setStorageType(e.target.value as 'link' | 'upload')} className="w-full">
              <option value="link">External link (recommended)</option>
              <option value="upload">Upload file</option>
            </Select>
          </div>
          {storageType === 'link' ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Link URL</Label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://drive.google.com/…" required />
            </div>
          ) : (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>File</Label>
              <Input type="file" onChange={onFile} required />
            </div>
          )}
          <div className="sm:col-span-3">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Add resource'}
            </Button>
            {create.isError && <span className="ml-3 text-sm text-destructive">{(create.error as Error).message}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
