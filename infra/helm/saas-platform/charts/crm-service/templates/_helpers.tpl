{{- define "crm-service.name" -}}
{{- include "common.name" . }}
{{- end }}
{{- define "crm-service.fullname" -}}
{{- include "common.fullname" . }}
{{- end }}
{{- define "crm-service.labels" -}}
{{- include "common.labels" . }}
{{- end }}
{{- define "crm-service.selectorLabels" -}}
{{- include "common.selectorLabels" . }}
{{- end }}
