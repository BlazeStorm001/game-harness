import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { readFile } from "node:fs/promises";
import {
  resolve,
  relative,
  isAbsolute,
  extname,
} from "node:path";


export default function imageGenerationExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "generate_image",

    label: "Generate Image",

    description:
      "Generate a visual asset using Cloudflare FLUX.1 Schnell. " +
      "The image is saved into assets/generated/ and returned visually " +
      "so it can be inspected immediately.",

    promptSnippet:
      "Generate PNG game assets with Cloudflare FLUX when custom artwork is genuinely useful",

    promptGuidelines: [
      "Use generate_image selectively for game artwork such as sprites, backgrounds, textures, environmental art, and UI artwork.",
      "Inspect the image returned by generate_image before integrating or regenerating it.",
      "Prefer existing assets, CSS, SVG, canvas, or procedural graphics when image generation is unnecessary.",
      "Avoid generating many speculative variants of the same asset.",
    ],

    parameters: Type.Object({
      prompt: Type.String({
        description:
          "Detailed description of the image to generate.",
        minLength: 1,
        maxLength: 2048,
      }),

      output: Type.Optional(
        Type.String({
          description:
            "Project-relative PNG output path under assets/generated/. " +
            "Example: assets/generated/security-drone.png",
        }),
      ),

      steps: Type.Optional(
        Type.Integer({
          description:
            "FLUX diffusion steps. 4 is recommended. Range: 1-8.",
          minimum: 1,
          maximum: 8,
          default: 4,
        }),
      ),

      removeBackground: Type.Optional(
        Type.Boolean({
          description:
            "Remove the image background after generation. " +
            "Useful for sprites, pickups, icons, and isolated objects.",
          default: false,
        }),
      ),
    }),

    async execute(
      _toolCallId,
      params,
      signal,
      onUpdate,
      ctx,
    ) {
      const steps = params.steps ?? 4;
      const removeBackground = params.removeBackground ?? false;

      const output =
        params.output ??
        `assets/generated/generated-${Date.now()}.png`;

      //
      // Safety: only allow generated images inside assets/generated/
      //
      if (isAbsolute(output)) {
        throw new Error(
          "Output path must be relative to the project.",
        );
      }

      if (extname(output).toLowerCase() !== ".png") {
        throw new Error(
          "generate_image output must use the .png extension.",
        );
      }

      const generatedRoot = resolve(
        ctx.cwd,
        "assets/generated",
      );

      const absoluteOutput = resolve(
        ctx.cwd,
        output,
      );

      const rel = relative(
        generatedRoot,
        absoluteOutput,
      );

      if (
        rel.startsWith("..") ||
        isAbsolute(rel)
      ) {
        throw new Error(
          "Output must be inside assets/generated/.",
        );
      }

      onUpdate?.({
        content: [
          {
            type: "text",
            text: `Generating ${output}...`,
          },
        ],
        details: {
          output,
          steps,
          removeBackground,
        },
      });

      const script = resolve(
        ctx.cwd,
        "scripts/generate-image.sh",
      );

      const args = [
        params.prompt,
        output,
        String(steps),
      ];

      if (removeBackground) {
        args.push("--remove-bg");
      }

      const result = await pi.exec(
        script,
        args,
        {
          signal,
          timeout: 300_000,
        },
      );

      if (result.code !== 0) {
        throw new Error(
          [
            "Image generation failed.",
            result.stderr,
            result.stdout,
          ]
            .filter(Boolean)
            .join("\n"),
        );
      }

      const image = await readFile(
        absoluteOutput,
      );

      return {
        content: [
          {
            type: "text",
            text:
              `Generated image successfully.\n` +
              `Path: ${output}\n` +
              `Steps: ${steps}\n` +
              `Background removed: ${removeBackground}`,
          },

          {
            type: "image",
            data: image.toString("base64"),
            mimeType: "image/png",
          },
        ],

        details: {
          output,
          absoluteOutput,
          steps,
          removeBackground,
          bytes: image.length,
        },
      };
    },
  });
}
