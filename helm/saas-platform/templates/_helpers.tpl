{{/*
공공기관 SaaS 프레임워크 Helm 공통 함수
Design Ref: DESIGN-MTU-N04 | Plan SC: FR-N04.13
*/}}

{{/*
Chart 전체 이름
*/}}
{{- define "saas-platform.fullname" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Chart 이름
*/}}
{{- define "saas-platform.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
공통 레이블
*/}}
{{- define "saas-platform.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: saas-platform
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}

{{/*
서비스별 레이블
*/}}
{{- define "saas-platform.serviceLabels" -}}
app: {{ .name }}
{{ include "saas-platform.labels" .context }}
{{- end }}

{{/*
서비스별 셀렉터 레이블
*/}}
{{- define "saas-platform.selectorLabels" -}}
app: {{ .name }}
{{- end }}

{{/*
네임스페이스
*/}}
{{- define "saas-platform.namespace" -}}
{{- default "saas-platform" .Values.namespace }}
{{- end }}

{{/*
Secret 이름
*/}}
{{- define "saas-platform.secretName" -}}
{{- if .Values.secrets.create -}}
{{ include "saas-platform.fullname" . }}-secrets
{{- else -}}
{{ .Values.secrets.existingSecretName }}
{{- end -}}
{{- end }}

{{/*
공통 보안 컨텍스트 (Pod 레벨) -- CSAP D-11
*/}}
{{- define "saas-platform.podSecurityContext" -}}
runAsNonRoot: true
runAsUser: 1001
fsGroup: 1001
{{- end }}

{{/*
공통 보안 컨텍스트 (컨테이너 레벨) -- CSAP D-11
*/}}
{{- define "saas-platform.containerSecurityContext" -}}
readOnlyRootFilesystem: true
allowPrivilegeEscalation: false
capabilities:
  drop: ["ALL"]
{{- end }}
