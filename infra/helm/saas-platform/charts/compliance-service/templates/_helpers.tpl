{{- define "compliance-service.name" -}}
{{- include "common.name" . }}
{{- end }}
{{- define "compliance-service.fullname" -}}
{{- include "common.fullname" . }}
{{- end }}
{{- define "compliance-service.labels" -}}
{{- include "common.labels" . }}
{{- end }}
{{- define "compliance-service.selectorLabels" -}}
{{- include "common.selectorLabels" . }}
{{- end }}
