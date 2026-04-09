{{- define "saas-catalog-service.name" -}}
{{- include "common.name" . }}
{{- end }}
{{- define "saas-catalog-service.fullname" -}}
{{- include "common.fullname" . }}
{{- end }}
{{- define "saas-catalog-service.labels" -}}
{{- include "common.labels" . }}
{{- end }}
{{- define "saas-catalog-service.selectorLabels" -}}
{{- include "common.selectorLabels" . }}
{{- end }}
