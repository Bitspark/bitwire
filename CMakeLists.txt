cmake_minimum_required(VERSION 3.21)
project(Bitwire VERSION 0.2.0 LANGUAGES CXX)

include(GNUInstallDirs)
include(CMakePackageConfigHelpers)

add_library(bitwire_wire INTERFACE)
add_library(Bitwire::wire ALIAS bitwire_wire)
set_target_properties(bitwire_wire PROPERTIES EXPORT_NAME wire)
target_compile_features(bitwire_wire INTERFACE cxx_std_20)
target_include_directories(bitwire_wire INTERFACE
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/wire/cpp/include>
    $<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>)

install(TARGETS bitwire_wire EXPORT BitwireTargets)
install(DIRECTORY wire/cpp/include/ DESTINATION "${CMAKE_INSTALL_INCLUDEDIR}")
install(FILES LICENSE wire/cpp/NOTICE DESTINATION "${CMAKE_INSTALL_DATADIR}/licenses/bitwire")

set(bitwire_cmake_dir "${CMAKE_INSTALL_LIBDIR}/cmake/Bitwire")
configure_package_config_file(cmake/BitwireConfig.cmake.in
    "${CMAKE_CURRENT_BINARY_DIR}/BitwireConfig.cmake"
    INSTALL_DESTINATION "${bitwire_cmake_dir}")
write_basic_package_version_file("${CMAKE_CURRENT_BINARY_DIR}/BitwireConfigVersion.cmake"
    VERSION "${PROJECT_VERSION}" COMPATIBILITY SameMinorVersion ARCH_INDEPENDENT)
install(EXPORT BitwireTargets NAMESPACE Bitwire:: DESTINATION "${bitwire_cmake_dir}")
install(FILES "${CMAKE_CURRENT_BINARY_DIR}/BitwireConfig.cmake"
    "${CMAKE_CURRENT_BINARY_DIR}/BitwireConfigVersion.cmake"
    DESTINATION "${bitwire_cmake_dir}")

option(BITWIRE_BUILD_TESTS "Build Bitwire C++ declaration and package checks" ${PROJECT_IS_TOP_LEVEL})
if(BITWIRE_BUILD_TESTS)
    enable_testing()
    add_executable(bitwire_contract_check wire/cpp/tests/contract.cpp)
    target_link_libraries(bitwire_contract_check PRIVATE Bitwire::wire)
    add_test(NAME cpp.contract COMMAND bitwire_contract_check)
    add_test(NAME cpp.installed-consumer
        COMMAND "${CMAKE_COMMAND}"
            "-DBITWIRE_BUILD_DIR=${CMAKE_CURRENT_BINARY_DIR}"
            "-DBITWIRE_CONSUMER_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/wire/cpp/tests/consumer"
            "-DBITWIRE_GENERATOR=${CMAKE_GENERATOR}"
            "-DBITWIRE_GENERATOR_PLATFORM=${CMAKE_GENERATOR_PLATFORM}"
            "-DBITWIRE_GENERATOR_TOOLSET=${CMAKE_GENERATOR_TOOLSET}"
            "-DBITWIRE_CXX_COMPILER=${CMAKE_CXX_COMPILER}"
            "-DBITWIRE_MAKE_PROGRAM=${CMAKE_MAKE_PROGRAM}"
            "-DBITWIRE_CONFIG=$<CONFIG>"
            -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/CheckInstalledConsumer.cmake")
endif()
