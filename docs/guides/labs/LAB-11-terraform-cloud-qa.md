# LAB-11 — Terraform & cloud infrastructure QA — planned

**Estado:** outline · **Track:** job-skills (avisos de empleo)  
**Gap en portfolio:** Understanding of Terraform or general cloud infrastructure concepts

**Stack previsto:** Terraform · Terratest · Checkov · LocalStack (lab local sin cloud paga)

---

## Objetivo

Validar infraestructura como código: `terraform validate/plan`, políticas de seguridad y smoke post-deploy.

---

## Prerrequisitos (cuando arranques)

- LAB-00 OK
- Terraform CLI instalado
- (Opcional) cuenta cloud free tier o LocalStack en Docker

---

## Outline de pasos (instructor completará en sesión)

1. Módulo Terraform mínimo (S3/bucket o container app de lab)
2. `terraform plan` — revisar diff como evidencia de QA
3. Checkov en CI — policy-as-code
4. Terratest o script smoke post-apply
5. Teardown y documentación de riesgos

---

## Para arrancar en chat

> **Lab LAB-11, paso 1** — modo instructor, Terraform local + validate.

**Variantes:** `terraform-local` · `terratest-go` · `checkov-ci`
