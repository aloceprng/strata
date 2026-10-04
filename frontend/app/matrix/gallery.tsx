"use client";

import type { ReactNode } from "react";

import {
  Badge,
  Button,
  Card,
  Field,
  Heading,
  IconButton,
  Input,
  Row,
  Select,
  Stack,
  Text,
} from "../components/primitives";
import styles from "./system.module.css";

export type Entry = {
  name: string;
  summary: string;
  tokens: string[];
  render: () => ReactNode;
};

export function Variant({
  label,
  fill,
  children,
}: {
  label: string;
  
  fill?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.variant} data-fill={fill || undefined}>
      <span className={styles.variantLabel}>{label}</span>
      {children}
    </div>
  );
}

export const COMPONENTS: Entry[] = [
  {
    name: "Button",
    summary: "",
    tokens: [
      "colour.action.*",
      "colour.secondary.*",
      "radius.control",
      "space.control.*",
      "size.control",
      "font.control.*",
      "border.control",
    ],
    render: () => (
      <>
        <Variant label="variant">
          <Stack direction="row" gap="tight">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </Stack>
        </Variant>
        <Variant label="size">
          <Stack direction="row" gap="tight" align="end">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </Stack>
        </Variant>
        <Variant label="brand default">
          <Button>No props passed</Button>
        </Variant>
      </>
    ),
  },
  {
    name: "IconButton",
    summary: "Control with no label, takes an accessible name instead.",
    tokens: ["size.control", "radius.control", "radius.pill", "colour.action.*"],
    render: () => (
      <Variant label="shape">
        <Stack direction="row" gap="tight">
          <IconButton label="Add">+</IconButton>
          <IconButton label="Swap" shape="circle">
            ⇄
          </IconButton>
          <IconButton label="Remove" variant="secondary">
            −
          </IconButton>
          <IconButton label="Confirm" variant="secondary" shape="circle">
            ✓
          </IconButton>
        </Stack>
      </Variant>
    ),
  },
  {
    name: "Badge",
    summary: "A small status or metadata marker, never interactive.",
    tokens: ["radius.pill", "colour.status.*", "font.caption.*"],
    render: () => (
      <>
        <Variant label="tone">
          <Stack direction="row" gap="tight">
            <Badge tone="neutral">Neutral</Badge>
            <Badge tone="accent">Accent</Badge>
            <Badge tone="danger">Danger</Badge>
          </Stack>
        </Variant>
        <Variant label="shape">
          <Stack direction="row" gap="tight">
            <Badge shape="pill">Pill</Badge>
            <Badge shape="square">Square</Badge>
          </Stack>
        </Variant>
      </>
    ),
  },
  {
    name: "Heading",
    summary: "Four levels, stepped down from the brand's heading size with a floor at body size.",
    tokens: ["font.heading.*"],
    render: () => (
      <Stack gap="tight">
        <Heading level={1}>Heading one</Heading>
        <Heading level={2}>Heading two</Heading>
        <Heading level={3}>Heading three</Heading>
        <Heading level={4}>Heading four</Heading>
      </Stack>
    ),
  },
  {
    name: "Text",
    summary: "Body copy and its tones.",
    tokens: ["font.body.*", "font.caption.*", "colour.text.*"],
    render: () => (
      <Stack gap="tight">
        <Text>Body text</Text>
        <Text tone="secondary">Secondary text</Text>
        <Text tone="accent">Accent text</Text>
        <Text tone="danger">Danger text</Text>
        <Text size="caption">Caption text</Text>
      </Stack>
    ),
  },
  {
    name: "Field",
    summary: "Label, control and description, carries the invalid state.",
    tokens: ["space.field.gap", "colour.text.secondary", "colour.status.danger"],
    render: () => (
      <>
        <Variant label="with input" fill>
          <Field label="Label" description="Helper text" htmlFor="f1">
            <Input id="f1" placeholder="Placeholder" />
          </Field>
        </Variant>
        <Variant label="with select" fill>
          <Field label="Label" htmlFor="f2">
            <Select id="f2" options={["Option one", "Option two", "Option three"]} />
          </Field>
        </Variant>
        <Variant label="invalid" fill>
          <Field label="Label" description="Error message" invalid htmlFor="f3">
            <Input id="f3" defaultValue="Invalid value" />
          </Field>
        </Variant>
      </>
    ),
  },
  {
    name: "Card",
    summary: "A surface that groups related content.",
    tokens: ["radius.card", "space.card.*", "border.card", "elevation.card", "colour.surface.raised"],
    render: () => (
      <>
        <Variant label="elevation">
          <Stack direction="row" gap="tight" align="start">
            <Card elevation="flat">
              <Heading level={4}>Flat</Heading>
              <Text tone="secondary">Supporting text</Text>
            </Card>
            <Card elevation="raised">
              <Heading level={4}>Raised</Heading>
              <Text tone="secondary">Supporting text</Text>
            </Card>
          </Stack>
        </Variant>
        <Variant label="composed" fill>
          <Card>
            <Heading level={4}>Card title</Heading>
            <Text tone="secondary">Supporting text that explains the card.</Text>
            <Stack direction="row" gap="tight">
              <Badge tone="accent">Badge</Badge>
              <Text>Value</Text>
            </Stack>
            <Button>Action</Button>
          </Card>
        </Variant>
      </>
    ),
  },
  {
    name: "Row",
    summary: "A list line with an optional meta column and a trailing value.",
    tokens: ["border.divider", "colour.border.subtle", "space.control.padding-y"],
    render: () => (
      <div style={{ width: "100%" }}>
        <Row label="Row label" meta="meta" value="Value" />
        <Row label="Row label" meta="meta" value="Value" />
        <Row label="Row label" value="Value" />
      </div>
    ),
  },
  {
    name: "Stack",
    summary: "Column or row, with three gap steps.",
    tokens: ["space.stack.gap", "space.stack.gap-loose", "space.control.gap"],
    render: () => (
      <>
        <Variant label="column">
          <Stack>
            <Badge>One</Badge>
            <Badge>Two</Badge>
          </Stack>
        </Variant>
        <Variant label="row · tight">
          <Stack direction="row" gap="tight">
            <Badge>One</Badge>
            <Badge>Two</Badge>
            <Badge>Three</Badge>
          </Stack>
        </Variant>
        <Variant label="row · loose">
          <Stack direction="row" gap="loose">
            <Badge>One</Badge>
            <Badge>Two</Badge>
          </Stack>
        </Variant>
      </>
    ),
  },
];
