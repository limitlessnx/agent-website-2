"use client";
import { useState } from "react";
import AIPresence from "@/components/ui/AIPresence";
import { aiPresenceLabels, type AIPresenceState } from "@/lib/ai-presence";
import {
  Button,
  CardHeader,
  DashboardCard,
  DashboardGrid,
  DataTable,
  EmptyState,
  InputField,
  LoadingSkeleton,
  MetricCard,
  NavigationItem,
  PageHeader,
  SearchFilters,
  SelectField,
  StatusBadge,
  TextareaField,
} from "@/components/ui/DashboardPrimitives";
import {
  Dialog,
  Drawer,
  DropdownMenu,
  Tabs,
  Toast,
} from "@/components/ui/DashboardInteractions";

export default function DesignSystemExamples() {
  const [exampleLoading, setExampleLoading] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [notification, setNotification] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  return (
    <>
      <PageHeader
        kicker="Shared foundation"
        title="Fluxknight design system"
        description="Synthetic examples of shared dashboard components. These controls do not create organizations or contact external services."
        actions={
          <>
            <Button onClick={() => setDialog(true)}>Open dialog</Button>
            <Button variant="outline" onClick={() => setDrawer(true)}>
              Open drawer
            </Button>
          </>
        }
      />
      {notification && (
        <Toast
          message={notification}
          tone="success"
          onDismiss={() => setNotification("")}
        />
      )}
      <DashboardGrid>
        <MetricCard
          label="Example organizations"
          value={4}
          detail="Synthetic sample"
        />
        <MetricCard label="Configuration required" value={2} tone="amber" />
        <MetricCard label="Example active" value={1} tone="emerald" />
      </DashboardGrid>
      <DashboardCard>
        <CardHeader
          title="Actions and feedback"
          description="Loading and disabled states apply only to their own action."
        />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Button onClick={() => setNotification("Local example completed.")}>
            Primary action
          </Button>
          <Button variant="outline">Secondary action</Button>
          <Button variant="ghost">Quiet action</Button>
          <Button loading={exampleLoading} loadingLabel="Saving example…">
            Save example
          </Button>
          <Button
            variant="ghost"
            onClick={() => setExampleLoading((value) => !value)}
          >
            Toggle example loading
          </Button>
          <Button disabled>Unavailable</Button>
          <Button loading action="saving">
            Save
          </Button>
          <DropdownMenu label="More actions">
            <button type="button" onClick={() => setDialog(true)}>
              View example details
            </button>
            <button type="button" onClick={() => setDrawer(true)}>
              Open example settings
            </button>
          </DropdownMenu>
        </div>
        <div
          style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 20 }}
        >
          <StatusBadge>Organization created</StatusBadge>
          <StatusBadge tone="info">Provisioning in progress</StatusBadge>
          <StatusBadge tone="warning">
            Awaiting customer configuration
          </StatusBadge>
          <StatusBadge tone="error">Needs attention</StatusBadge>
          <StatusBadge tone="info">Ready for testing</StatusBadge>
          <StatusBadge tone="warning">Ready for activation</StatusBadge>
          <StatusBadge tone="success">Active</StatusBadge>
        </div>
      </DashboardCard>
      <DashboardCard>
        <CardHeader
          title="Forms"
          description="Explicit labels, hints and validation feedback."
        />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
            if (name.trim())
              setNotification("Local form check complete. No data was saved.");
          }}
          noValidate
        >
          <DashboardGrid>
            <InputField
              id="example-name"
              label="Example organization name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              hint="Use synthetic information."
              error={
                submitted && !name.trim()
                  ? "Enter an organization name."
                  : undefined
              }
            />
            <SelectField
              id="example-industry"
              label="Industry"
              defaultValue="real-estate"
            >
              <option value="real-estate">Real Estate</option>
              <option value="photography">Photography</option>
              <option value="hotel">Hotel</option>
            </SelectField>
            <InputField
              id="example-disabled"
              label="Read-only example"
              disabled
              defaultValue="Unavailable"
            />
          </DashboardGrid>
          <div style={{ marginBlock: 20 }}>
            <TextareaField
              id="example-notes"
              label="Example notes"
              hint="This example never saves or sends the contents."
            />
          </div>
          <Button type="submit">Check example form</Button>
        </form>
      </DashboardCard>
      <DashboardCard>
        <CardHeader title="Search and filters" />
        <SearchFilters
          action="/dashboard/design-system"
          label="Search example records"
        >
          <SelectField
            id="example-filter"
            label="Example filter"
            name="industry"
            defaultValue="all"
          >
            <option value="all">All industries</option>
            <option value="hotel">Hotel</option>
          </SelectField>
        </SearchFilters>
      </DashboardCard>
      <DashboardCard>
        <Tabs
          label="Component examples"
          items={[
            {
              id: "table",
              label: "Table",
              content: (
                <DataTable label="Synthetic organizations">
                  <caption>Example records only</caption>
                  <thead>
                    <tr>
                      <th scope="col">Organization</th>
                      <th scope="col">Industry</th>
                      <th scope="col">Setup</th>
                      <th scope="col">Next action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Demo Realty", "Real Estate"],
                      ["Demo Studio", "Photography"],
                      ["Demo Hotel", "Hotel"],
                    ].map(([organization, industry]) => (
                      <tr key={organization}>
                        <th scope="row">{organization}</th>
                        <td>{industry}</td>
                        <td>
                          <StatusBadge tone="warning">
                            Awaiting configuration
                          </StatusBadge>
                        </td>
                        <td>Review business information</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              ),
            },
            {
              id: "empty",
              label: "Empty state",
              content: (
                <EmptyState
                  title="No test results yet"
                  description="Complete configuration before running a controlled test."
                />
              ),
            },
            {
              id: "loading",
              label: "Loading state",
              content: <LoadingSkeleton label="Loading example cards" />,
            },
            {
              id: "unavailable",
              label: "Unavailable tab",
              disabled: true,
              content: null,
            },
          ]}
        />
      </DashboardCard>
      <DashboardCard>
        <CardHeader title="Navigation" />
        <NavigationItem href="/dashboard/design-system" active>
          Design system examples
        </NavigationItem>
        <NavigationItem href="/dashboard/clients">
          Organization management
        </NavigationItem>
      </DashboardCard>
      <DashboardCard aria-label="Synthetic AI presence examples">
        <CardHeader title="AI presence states" description="Synthetic examples only. No agent is connected, listening, speaking or executing from this page." />
        <div className="settings-readonly-grid">
          {(Object.keys(aiPresenceLabels) as AIPresenceState[]).map(state => <AIPresence key={state} state={state} name="Example agent" />)}
        </div>
      </DashboardCard>
      <DashboardCard aria-label="Synthetic long property title example">
        <CardHeader title="Long content containment" description="Synthetic property, organization and email values for shared table verification." />
        <DataTable label="Long content example">
          <caption>Example records only; no customer data</caption>
          <thead><tr><th scope="col">Property</th><th scope="col">Organization</th><th scope="col">Contact</th></tr></thead>
          <tbody><tr><td>Marina Heights Waterfront Family Residence and Executive Business Suites — Phase Three North Wing</td><td>International Customer Experience and Business Operations Group</td><td>customer-experience-and-reservations-supervisor@example.test</td></tr></tbody>
        </DataTable>
      </DashboardCard>
      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Example dialog"
      >
        <p>
          This dialog is a synthetic example. Escape closes it and returns focus
          to the opening control.
        </p>
        <InputField id="dialog-name" label="Example label" />
        <div style={{ marginTop: 20 }}>
          <Button onClick={() => setDialog(false)}>Done</Button>
        </div>
      </Dialog>
      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Example drawer"
      >
        <p>Shared settings layout with a touch-friendly close control.</p>
        <InputField id="drawer-name" label="Example setting" />
      </Drawer>
    </>
  );
}
