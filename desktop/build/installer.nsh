; Fuerza a Explorer a refrescar los iconos y asociaciones después de instalar.
; Sin esto, Windows puede seguir mostrando el icono antiguo del acceso directo.
!macro customInstall
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
