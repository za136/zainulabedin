import { z } from 'zod';
import { localizedTextSchema } from './i18n';

/**
 * DIAGRAM SCENE SPEC (v1)
 * =======================
 * Interactive 3D diagrams that explain books are authored as plain JSON — no code.
 * A scene is a set of 3D nodes connected by edges, plus a guided "tour" of steps
 * (camera moves + highlighted nodes + bilingual narration).
 *
 * Files live in `stores/<store>/diagrams/<id>.json` and are validated by
 * `pnpm factory validate`. The storefront renders them with three.js.
 */

const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const color = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'hex colour like #ff8800');

export const diagramNodeSchema = z.object({
  id: z.string().min(1),
  label: localizedTextSchema,
  detail: localizedTextSchema.optional(),
  shape: z.enum(['box', 'sphere', 'cylinder', 'cone', 'torus', 'capsule', 'octahedron']).default('box'),
  position: vec3,
  scale: z.union([z.number().positive(), vec3]).default(1),
  color: color.default('#4f46e5'),
  /** Optional chapter reference inside the book */
  chapter: z.string().optional(),
  group: z.string().optional(),
});

export const diagramEdgeSchema = z.object({
  id: z.string().optional(),
  from: z.string(),
  to: z.string(),
  label: localizedTextSchema.optional(),
  color: color.default('#94a3b8'),
  style: z.enum(['solid', 'dashed']).default('solid'),
  directed: z.boolean().default(true),
  /** Animated particles flowing along the edge (data flow, causality, …) */
  flow: z.boolean().default(false),
});

export const diagramStepSchema = z.object({
  id: z.string(),
  title: localizedTextSchema,
  narration: localizedTextSchema,
  camera: z.object({ position: vec3, target: vec3 }).optional(),
  focus: z.array(z.string()).default([]),
});

export const diagramGroupSchema = z.object({ id: z.string(), label: localizedTextSchema, color: color.default('#e2e8f0') });

export const diagramSceneSchema = z
  .object({
    $schema: z.string().optional(),
    id: z.string().regex(/^[a-z0-9-]+$/),
    version: z.literal(1),
    title: localizedTextSchema,
    description: localizedTextSchema.optional(),
    background: color.default('#0b1020'),
    camera: z.object({ position: vec3, target: vec3 }).default({ position: [8, 6, 10], target: [0, 0, 0] }),
    groups: z.array(diagramGroupSchema).default([]),
    nodes: z.array(diagramNodeSchema).min(1),
    edges: z.array(diagramEdgeSchema).default([]),
    steps: z.array(diagramStepSchema).default([]),
  })
  .superRefine((scene, ctx) => {
    const ids = new Set<string>();
    for (const n of scene.nodes) {
      if (ids.has(n.id)) ctx.addIssue({ code: 'custom', message: `duplicate node id "${n.id}"`, path: ['nodes'] });
      ids.add(n.id);
    }
    const groups = new Set(scene.groups.map((g) => g.id));
    scene.nodes.forEach((n, i) => {
      if (n.group && !groups.has(n.group)) ctx.addIssue({ code: 'custom', message: `unknown group "${n.group}"`, path: ['nodes', i, 'group'] });
    });
    scene.edges.forEach((e, i) => {
      if (!ids.has(e.from)) ctx.addIssue({ code: 'custom', message: `edge.from references unknown node "${e.from}"`, path: ['edges', i, 'from'] });
      if (!ids.has(e.to)) ctx.addIssue({ code: 'custom', message: `edge.to references unknown node "${e.to}"`, path: ['edges', i, 'to'] });
    });
    scene.steps.forEach((s, i) =>
      s.focus.forEach((f) => {
        if (!ids.has(f)) ctx.addIssue({ code: 'custom', message: `step focuses unknown node "${f}"`, path: ['steps', i, 'focus'] });
      }),
    );
  });

export type DiagramScene = z.infer<typeof diagramSceneSchema>;
export type DiagramNode = z.infer<typeof diagramNodeSchema>;
export type DiagramEdge = z.infer<typeof diagramEdgeSchema>;
export type DiagramStep = z.infer<typeof diagramStepSchema>;
