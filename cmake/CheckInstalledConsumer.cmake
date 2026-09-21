cmake_minimum_required(VERSION 3.21)

# Only the installed headers/configuration reach this copied consumer. In CI,
# BITWIRE_BUILD_DIR is outside the checkout as well.
set(consumer_root "${BITWIRE_BUILD_DIR}/installed-consumer")
set(prefix "${consumer_root}/prefix")
file(MAKE_DIRECTORY "${consumer_root}/source")
file(COPY "${BITWIRE_CONSUMER_SOURCE}/" DESTINATION "${consumer_root}/source")

function(run)
    execute_process(COMMAND ${ARGV} RESULT_VARIABLE status)
    if(NOT status EQUAL 0)
        message(FATAL_ERROR "Installed consumer command failed (${status}): ${ARGV}")
    endif()
endfunction()

set(config_args)
if(BITWIRE_CONFIG)
    list(APPEND config_args --config "${BITWIRE_CONFIG}")
endif()
run("${CMAKE_COMMAND}" --install "${BITWIRE_BUILD_DIR}" --prefix "${prefix}" ${config_args})

set(generator_args -G "${BITWIRE_GENERATOR}")
if(BITWIRE_GENERATOR_PLATFORM)
    list(APPEND generator_args -A "${BITWIRE_GENERATOR_PLATFORM}")
endif()
if(BITWIRE_GENERATOR_TOOLSET)
    list(APPEND generator_args -T "${BITWIRE_GENERATOR_TOOLSET}")
endif()
run("${CMAKE_COMMAND}" -S "${consumer_root}/source" -B "${consumer_root}/build"
    ${generator_args}
    "-DCMAKE_CXX_COMPILER=${BITWIRE_CXX_COMPILER}"
    "-DCMAKE_MAKE_PROGRAM=${BITWIRE_MAKE_PROGRAM}"
    "-DCMAKE_BUILD_TYPE=${BITWIRE_CONFIG}"
    "-DCMAKE_PREFIX_PATH=${prefix}"
    -DCMAKE_FIND_USE_PACKAGE_REGISTRY=OFF
    -DCMAKE_FIND_USE_SYSTEM_PACKAGE_REGISTRY=OFF)
run("${CMAKE_COMMAND}" --build "${consumer_root}/build" ${config_args})
find_program(consumer_ctest NAMES ctest REQUIRED)
set(ctest_config_args)
if(BITWIRE_CONFIG)
    list(APPEND ctest_config_args -C "${BITWIRE_CONFIG}")
endif()
run("${consumer_ctest}" --test-dir "${consumer_root}/build"
    ${ctest_config_args} --output-on-failure)
