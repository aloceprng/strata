from django.conf import settings
from django.contrib import admin
from django.urls import path
from django.views.static import serve

from tokens import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/brands/<slug:slug>/pipeline', views.pipeline),
    path('api/brands/<slug:slug>/check', views.check),
]

if settings.DEBUG:
    urlpatterns += [
        path(
            'artifacts/<path:path>',
            serve,
            {'document_root': settings.ARTIFACT_ROOT},
        ),
    ]
